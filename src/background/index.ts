/**
 * Background Service Worker — the brain of RoadmapHub.
 *
 * Handles:
 *  - GitHub OAuth via chrome.identity.launchWebAuthFlow
 *  - Message routing from content script and popup
 *  - AI enhancement orchestration
 *  - GitHub commit orchestration
 */
import { MSG, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_SCOPES, GEMINI_API_KEY } from "@/lib/constants";
import type { LearningCommitPayload, AIEnhanceRequest, AuthStatus } from "@/lib/types";
import { ensureRepo, commitLearning } from "./github";
import { enhanceWithAI, buildMarkdown } from "./ai";

// ========== Chrome message listener ==========
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
      handleCommit(payload).then(sendResponse);
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

    console.log("[RoadmapHub] Starting OAuth flow...");
    console.log("[RoadmapHub] Redirect URL:", redirectUrl);

    // Launch the auth flow — opens GitHub in a popup
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });

    if (!responseUrl) {
      return { success: false, error: "OAuth flow was cancelled." };
    }

    // Extract the auth code from the redirect URL
    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");

    if (!code) {
      return { success: false, error: "No authorization code received from GitHub." };
    }

    // Exchange the code for an access token
    const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResp.ok) {
      return { success: false, error: `Token exchange failed: ${tokenResp.status}` };
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return {
        success: false,
        error: tokenData.error_description || "Failed to get access token.",
      };
    }

    // Fetch user info
    const userResp = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResp.ok) {
      return { success: false, error: "Failed to fetch GitHub user info." };
    }

    const user = await userResp.json();

    // Store everything
    await chrome.storage.local.set({
      gh_token: accessToken,
      gh_username: user.login,
      gh_avatar: user.avatar_url,
    });

    // Ensure repo exists
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
    const data = await enhanceWithAI(GEMINI_API_KEY, payload);
    return { success: true, data };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ========== Commit Handler ==========
async function handleCommit(
  payload: LearningCommitPayload
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const result = await chrome.storage.local.get(["gh_token"]);
    const token = result.gh_token;
    if (!token) {
      return { success: false, error: "Not connected to GitHub. Click the extension icon to connect." };
    }

    // Enhance with AI
    let aiSummary: string | undefined;
    let aiKeyConcepts: string[] | undefined;
    let tags = payload.tags;

    try {
      const aiResult = await enhanceWithAI(GEMINI_API_KEY, {
        topicName: payload.topic.topicName,
        roadmapDomain: payload.topic.roadmapDomain,
        description: payload.topic.description,
        notes: payload.notes,
      });
      aiSummary = aiResult.summary;
      aiKeyConcepts = aiResult.keyConcepts;
      if (aiResult.tags?.length) {
        tags = Array.from(new Set([...tags, ...aiResult.tags]));
      }
    } catch {
      // AI failed, proceed without it
    }

    const markdown = buildMarkdown(
      payload.topic.topicName,
      payload.topic.roadmapDomain,
      payload.topic.roadmapSlug,
      payload.topic.description,
      payload.notes,
      payload.code,
      payload.topic.resources,
      tags,
      aiSummary,
      aiKeyConcepts
    );

    const url = await commitLearning(token, payload, markdown);
    return { success: true, url };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
