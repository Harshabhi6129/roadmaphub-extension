/**
 * Background Service Worker — the brain of RoadmapHub.
 *
 * Handles:
 *  - GitHub OAuth via chrome.identity.launchWebAuthFlow
 *  - Message routing from content script and popup
 *  - AI enhancement orchestration
 *  - GitHub commit orchestration
 */
import { MSG, GITHUB_CLIENT_ID, GITHUB_SCOPES, WORKER_BASE_URL, EXTENSION_SECRET } from "@/lib/constants";
import type { LearningCommitPayload, AIEnhanceRequest, AuthStatus, TypedExtensionMessage } from "@/lib/types";
import { ensureRepo, commitLearning, updateReadme } from "./github";
import { enhanceWithAI, buildMarkdown } from "./ai";
import { addToQueue } from "./queue";
import { setupAlarms } from "./alarms";
import { syncProgressFromPage, recordCommit, getProgressStore } from "@/lib/progressStore";
import { getOfficialTopicCount } from "@/lib/roadmapData";

// Initialize alarms
setupAlarms();

// ========== Chrome message listener ==========
chrome.runtime.onMessage.addListener((message: TypedExtensionMessage, _sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case MSG.GET_AUTH_STATUS:
      handleGetAuthStatus().then(sendResponse);
      return true; // async

    case MSG.LOGIN_GITHUB:
      handleOAuthLogin().then(sendResponse);
      return true;

    case MSG.LOGOUT_GITHUB:
      handleLogout().then(sendResponse);
      return true;

    case MSG.AI_ENHANCE:
      handleAIEnhance(payload).then(sendResponse);
      return true;

    case MSG.COMMIT_LEARNING:
      handleCommit(payload, sendResponse);
      return true;

    case MSG.SYNC_PROGRESS:
      handleSyncProgress(payload).then(sendResponse);
      return true;

    case MSG.CHECK_TOPIC_EXISTS:
      handleCheckTopicExists(payload).then(sendResponse);
      return true;
  }
});

// ========== Auth Handlers ==========
async function handleGetAuthStatus(): Promise<AuthStatus> {
  const result = await chrome.storage.local.get(["gh_token", "gh_username", "gh_avatar"]);
  if (result.gh_token) {
    return {
      isLoggedIn: true,
      username: result.gh_username,
      avatarUrl: result.gh_avatar,
    };
  }
  return { isLoggedIn: false };
}

/**
 * GitHub OAuth flow using chrome.identity.launchWebAuthFlow.
 *
 * 1. Opens GitHub's authorize URL in a popup
 * 2. User authorizes → GitHub redirects with auth code
 * 3. We exchange the code for an access token
 * 4. Store the token in chrome.storage.local
 */
async function handleOAuthLogin(): Promise<{ success: boolean; error?: string }> {
  try {
    // Build the GitHub authorization URL
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("scope", GITHUB_SCOPES);
    authUrl.searchParams.set("state", crypto.randomUUID());

    console.log("[RoadmapHub] Starting OAuth flow via Worker Proxy...");

    // 1. Launch the auth flow with a 2-minute timeout
    const authPromise = chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    const timeoutPromise = new Promise<undefined>((_, reject) =>
      setTimeout(() => reject(new Error("Authentication timed out (2 minutes).")), 120000)
    );

    const responseUrl = await Promise.race([authPromise, timeoutPromise]);

    if (!responseUrl) {
      return { success: false, error: "OAuth flow was cancelled or timed out." };
    }

    // 2. Extract the auth code
    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");

    if (!code) {
      return { success: false, error: "No authorization code received from GitHub." };
    }

    // 3. Exchange the code via Worker Proxy (Secure)
    const response = await fetch(`${WORKER_BASE_URL}/github/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Extension-Secret": EXTENSION_SECRET
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      return { success: false, error: `Worker Proxy error: ${response.status}` };
    }

    const tokenData = await response.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return {
        success: false,
        error: tokenData.error_description || "Failed to get access token from worker.",
      };
    }

    // 4. Fetch user info
    const userResp = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResp.ok) {
      return { success: false, error: "Failed to fetch GitHub user info." };
    }

    const user = await userResp.json();

    // 5. Store token and metadata
    await chrome.storage.local.set({
      gh_token: accessToken,
      gh_username: user.login,
      gh_avatar: user.avatar_url,
    });

    // 6. Ensure repo exists
    await ensureRepo(accessToken);

    console.log("[RoadmapHub] ✅ OAuth complete:", user.login);
    return { success: true };
  } catch (e) {
    console.error("[RoadmapHub] OAuth error:", e);
    return { success: false, error: (e as Error).message };
  }
}

async function handleLogout(): Promise<{ success: boolean }> {
  await chrome.storage.local.remove(["gh_token", "gh_username", "gh_avatar"]);
  return { success: true };
}

// ========== AI Handler ==========
async function handleAIEnhance(
  payload: AIEnhanceRequest
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const data = await enhanceWithAI(payload);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ========== Commit Handler ==========
async function handleCommit(
  payload: LearningCommitPayload,
  sendResponse: (response?: any) => void
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    console.log("[RoadmapHub] 📥 Commit request received for:", payload.topic.topicName);
    
    const result = await chrome.storage.local.get(["gh_token"]);
    const token = result.gh_token;
    if (!token) {
      return { success: false, error: "Not connected to GitHub. Click the extension icon to connect." };
    }

    // AI summary is now handled by the UI before sending the commit request
    const markdown = buildMarkdown(
      payload.topic.topicName,
      payload.topic.roadmapDomain,
      payload.topic.roadmapSlug,
      payload.topic.description,
      payload.notes,
      payload.code,
      payload.topic.resources,
      payload.tags,
      undefined, // aiSummary is already in payload.topic.description if applied
      undefined  // aiKeyConcepts are already in payload.notes if applied
    );

    console.log("[RoadmapHub] 📝 Markdown built, length:", markdown.length);

    try {
      console.log("[RoadmapHub] 🚀 Committing note to GitHub...");
      const url = await commitLearning(token, payload, markdown);
      console.log("[RoadmapHub] ✅ Note committed:", url);
      
      // Respond to UI IMMEDIATELY after primary commit logic
      sendResponse({ success: true, url });

      // Non-blocking background updates (Progress & Dashboard)
      (async () => {
        try {
          console.log("[RoadmapHub] ⚙️ Starting background sync (Progress & README)...");
          const slug = payload.topic.roadmapSlug;
          
          // Fast sync: pass token to avoid rate limits
          const officialCount = await getOfficialTopicCount(slug, token);
          
          const fullStore = await recordCommit(
            slug,
            payload.topic.topicSlug,
            payload.topic.topicName,
            `${slug}/${payload.topic.topicSlug}.md`,
            payload.topic.roadmapDomain,
            payload.topic.completedTopics,
            officialCount || payload.topic.totalTopics
          );

          const { gh_username } = await chrome.storage.local.get("gh_username");
          await updateReadme(token, gh_username, fullStore);
          console.log("[RoadmapHub] ✨ Background sync complete.");
        } catch (bgErr) {
          console.error("[RoadmapHub] ❌ Background sync failed:", bgErr);
        }
      })();

      return { success: true, url }; // returned to the .then() chain, but UI got it via sendResponse already
    } catch (e) {
      console.warn("[RoadmapHub] ⚠️ Direct commit flow interrupted, adding to offline queue...", e);
      await addToQueue(payload, markdown);
      return { 
        success: true, 
        error: "Commit queued! It will be pushed automatically when you are back online." 
      };
    }
  } catch (e) {
    console.error("[RoadmapHub] ❌ handleCommit critical error:", e);
    return { success: false, error: (e as Error).message };
  }
}

async function handleSyncProgress(payload: {
  slug: string;
  completed: number;
  total: number;
  displayName: string;
}) {
  try {
    await syncProgressFromPage(payload.slug, payload.completed, payload.total, payload.displayName);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * Checks if a topic has been already committed.
 * NOTE: This is based on the local progressStore. If a user reinstalls the extension
 * or clears local storage, it may lose track of previously committed topics until
 * a new commit or full sync reconciles it.
 */
async function handleCheckTopicExists(payload: {
  slug: string;
  topicSlug: string;
}): Promise<{ exists: boolean }> {
  try {
    const store = await getProgressStore();
    const roadmap = store[payload.slug];
    const exists = roadmap?.committedSlugs?.includes(payload.topicSlug) || false;
    return { exists };
  } catch (e) {
    return { exists: false };
  }
}
