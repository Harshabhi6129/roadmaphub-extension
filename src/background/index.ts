/**
 * Background Service Worker — the brain of RoadmapHub.
 *
 * Handles:
 *  - GitHub OAuth via chrome.identity.launchWebAuthFlow
 *  - Message routing from content script and popup
 *  - AI enhancement orchestration
 *  - GitHub commit orchestration
 *  - Reinstall recovery (GitHub sync)
 *  - Bulk commit
 *  - Settings management
 *  - Streak tracking
 *  - Notes export
 *  - Roadmap changelog detection
 */
import {
  MSG,
  GITHUB_CLIENT_ID,
  GITHUB_SCOPES,
  WORKER_BASE_URL,
  EXTENSION_SECRET,
  GITHUB_ERRORS,
} from "@/lib/constants";
import type {
  LearningCommitPayload,
  AIEnhanceRequest,
  AuthStatus,
  TypedExtensionMessage,
  TopicMetadata,
  BulkCommitResult,
  ChangelogCheckResult,
} from "@/lib/types";
import {
  ensureRepo,
  commitLearning,
  updateReadme,
  syncCommittedSlugsFromGitHub,
  translateGitHubError,
} from "./github";
import { enhanceWithAI, buildMarkdown } from "./ai";
import { addToQueue } from "./queue";
import { setupAlarms } from "./alarms";
import {
  syncProgressFromPage,
  recordCommit,
  getProgressStore,
  rebuildFromGitHub,
  generateExportMarkdown,
} from "@/lib/progressStore";
import { getOfficialTopicCount } from "@/lib/roadmapData";
import { getSettings, saveSettings } from "@/lib/settings";
import { getStreakData, recordCommitForStreak } from "@/lib/streakStore";

setupAlarms();

// ========== Message listener ==========

chrome.runtime.onMessage.addListener(
  (message: TypedExtensionMessage, _sender, sendResponse) => {
    const { type, payload } = message;

    switch (type) {
      case MSG.GET_AUTH_STATUS:
        handleGetAuthStatus().then(sendResponse);
        return true;

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

      case MSG.SYNC_FROM_GITHUB:
        handleSyncFromGitHub().then(sendResponse);
        return true;

      case MSG.BULK_COMMIT:
        handleBulkCommit(payload.topics, sendResponse);
        return true;

      case MSG.GET_SETTINGS:
        getSettings().then(sendResponse);
        return true;

      case MSG.SAVE_SETTINGS:
        saveSettings(payload).then(() => sendResponse({ success: true }));
        return true;

      case MSG.GET_STREAK:
        getStreakData().then(sendResponse);
        return true;

      case MSG.EXPORT_NOTES:
        handleExportNotes().then(sendResponse);
        return true;

      case MSG.CHECK_ROADMAP_UPDATES:
        handleCheckRoadmapUpdates(payload).then(sendResponse);
        return true;
    }
  }
);

// ========== Auth handlers ==========

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

async function handleOAuthLogin(): Promise<{ success: boolean; error?: string }> {
  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", redirectUrl);
    authUrl.searchParams.set("scope", GITHUB_SCOPES);
    authUrl.searchParams.set("state", crypto.randomUUID());

    const authPromise = chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true,
    });
    const timeoutPromise = new Promise<undefined>((_, reject) =>
      setTimeout(
        () => reject(new Error("Authentication timed out. Please try again.")),
        120000
      )
    );

    const responseUrl = await Promise.race([authPromise, timeoutPromise]);
    if (!responseUrl) {
      return { success: false, error: "Sign-in was cancelled or timed out." };
    }

    const url = new URL(responseUrl);
    const code = url.searchParams.get("code");
    if (!code) {
      return { success: false, error: "No authorization code received from GitHub." };
    }

    const response = await fetch(`${WORKER_BASE_URL}/github/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Extension-Secret": EXTENSION_SECRET,
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const status = response.status;
      const msg = GITHUB_ERRORS[status] || `Sign-in failed (server error ${status}). Try again.`;
      return { success: false, error: msg };
    }

    const tokenData = await response.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return {
        success: false,
        error: tokenData.error_description || "Could not get access token. Try again.",
      };
    }

    const userResp = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userResp.ok) {
      return { success: false, error: "Connected to GitHub but could not load your profile. Try signing in again." };
    }

    const user = await userResp.json();
    await chrome.storage.local.set({
      gh_token: accessToken,
      gh_username: user.login,
      gh_avatar: user.avatar_url,
    });

    const settings = await getSettings();
    await ensureRepo(accessToken);

    // Warm the topic count cache and sync any existing repo data in the background
    handleSyncFromGitHub().catch(console.error);

    console.log("[RoadmapHub] OAuth complete:", user.login);
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

async function handleLogout(): Promise<{ success: boolean }> {
  await chrome.storage.local.remove(["gh_token", "gh_username", "gh_avatar", "repo_confirmed"]);
  return { success: true };
}

// ========== AI handler ==========

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

// ========== Commit handler ==========

async function handleCommit(
  payload: LearningCommitPayload,
  sendResponse: (response?: any) => void
): Promise<void> {
  try {
    const result = await chrome.storage.local.get(["gh_token"]);
    const token = result.gh_token;
    if (!token) {
      sendResponse({
        success: false,
        error: "Not connected to GitHub. Please sign in via the extension popup.",
      });
      return;
    }

    const settings = await getSettings();

    const markdown = buildMarkdown(
      payload.topic.topicName,
      payload.topic.roadmapDomain,
      payload.topic.roadmapSlug,
      payload.topic.description,
      payload.notes,
      payload.code,
      payload.topic.resources,
      payload.tags
    );

    try {
      const commitWithTimeout = Promise.race([
        commitLearning(token, payload, markdown, settings.repoName),
        new Promise<string>((_, reject) =>
          setTimeout(
            () => reject(new Error("Commit timed out after 30 seconds. Check your connection and try again.")),
            30000
          )
        ),
      ]);

      const url = await commitWithTimeout;

      // Respond to UI immediately
      sendResponse({ success: true, url });

      // Non-blocking background work
      (async () => {
        try {
          const slug = payload.topic.roadmapSlug;
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

          await recordCommitForStreak();

          const { gh_username } = await chrome.storage.local.get("gh_username");
          await updateReadme(token, gh_username, fullStore, settings.repoName);
        } catch (bgErr) {
          console.error("[RoadmapHub] Background sync failed:", bgErr);
        }
      })();
    } catch (commitError: any) {
      // Primary commit failed — queue it for offline retry
      try {
        await addToQueue(payload, markdown);
        sendResponse({
          success: true,
          url: "",
          queued: true,
          error: "You appear to be offline. Your commit has been queued and will be pushed automatically when you reconnect.",
        });
      } catch (queueError: any) {
        sendResponse({
          success: false,
          error: commitError.message || "Commit failed. Check your connection and try again.",
        });
      }
    }
  } catch (e: any) {
    sendResponse({ success: false, error: e.message });
  }
}

// ========== Progress handler ==========

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

// ========== Topic exists check (with auto reinstall-recovery) ==========

async function handleCheckTopicExists(payload: {
  slug: string;
  topicSlug: string;
}): Promise<{ exists: boolean }> {
  try {
    const store = await getProgressStore();

    // If the store is completely empty (fresh install or reinstall), trigger a
    // background GitHub sync so committedSlugs are rebuilt. We don't await it
    // here because we don't want to delay the UI — it will be correct on the
    // next topic the user opens.
    const totalCommitted = Object.values(store).reduce(
      (sum, r) => sum + (r.committedSlugs?.length || 0),
      0
    );
    if (totalCommitted === 0) {
      handleSyncFromGitHub().catch(console.error);
    }

    const roadmap = store[payload.slug];
    const exists = roadmap?.committedSlugs?.includes(payload.topicSlug) || false;
    return { exists };
  } catch {
    return { exists: false };
  }
}

// ========== GitHub reinstall sync ==========

async function handleSyncFromGitHub(): Promise<{ success: boolean; synced?: number; error?: string }> {
  const { gh_token } = await chrome.storage.local.get("gh_token");
  if (!gh_token) return { success: false, error: "Not connected to GitHub." };

  try {
    const settings = await getSettings();
    const slugMap = await syncCommittedSlugsFromGitHub(gh_token, settings.repoName);
    await rebuildFromGitHub(slugMap);
    const synced = Object.values(slugMap).reduce((s, v) => s + v.length, 0);
    console.log(`[RoadmapHub] Synced ${synced} topics from GitHub.`);
    return { success: true, synced };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ========== Bulk commit handler ==========

async function handleBulkCommit(
  topics: TopicMetadata[],
  sendResponse: (response?: any) => void
): Promise<void> {
  const { gh_token } = await chrome.storage.local.get("gh_token");
  if (!gh_token) {
    sendResponse({ success: false, error: "Not connected to GitHub." });
    return;
  }

  const store = await getProgressStore();
  const settings = await getSettings();
  const result: BulkCommitResult = { committed: 0, skipped: 0, failed: 0, topicNames: [] };

  for (const topic of topics) {
    // Skip topics already committed
    const alreadyCommitted = store[topic.roadmapSlug]?.committedSlugs?.includes(topic.topicSlug);
    if (alreadyCommitted) {
      result.skipped++;
      continue;
    }

    const markdown = buildMarkdown(
      topic.topicName,
      topic.roadmapDomain,
      topic.roadmapSlug,
      topic.description,
      "",
      "",
      topic.resources,
      []
    );

    const payload: LearningCommitPayload = {
      topic,
      notes: "",
      code: "",
      tags: [],
      commitMessage: `learn(${topic.roadmapSlug}): ${topic.topicName}`,
      practiceFiles: [],
    };

    try {
      await commitLearning(gh_token, payload, markdown, settings.repoName);
      await recordCommit(
        topic.roadmapSlug,
        topic.topicSlug,
        topic.topicName,
        `${topic.roadmapSlug}/${topic.topicSlug}.md`,
        topic.roadmapDomain,
        topic.completedTopics,
        topic.totalTopics
      );
      result.committed++;
      result.topicNames.push(topic.topicName);
    } catch (e) {
      console.error(`[RoadmapHub] Bulk commit failed for ${topic.topicName}:`, e);
      result.failed++;
    }
  }

  if (result.committed > 0) {
    await recordCommitForStreak();
    // Update README after all bulk commits
    try {
      const fullStore = await getProgressStore();
      const { gh_username } = await chrome.storage.local.get("gh_username");
      await updateReadme(gh_token, gh_username, fullStore, settings.repoName);
    } catch (e) {
      console.error("[RoadmapHub] README update after bulk commit failed:", e);
    }
  }

  sendResponse({ success: true, result });
}

// ========== Export handler ==========

async function handleExportNotes(): Promise<{ success: boolean; markdown?: string; error?: string }> {
  try {
    const store = await getProgressStore();
    const markdown = generateExportMarkdown(store);
    return { success: true, markdown };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ========== Roadmap changelog detection ==========

async function handleCheckRoadmapUpdates(payload: {
  slug: string;
  currentCount: number;
}): Promise<ChangelogCheckResult> {
  const store = await getProgressStore();
  const previousCount = store[payload.slug]?.total || 0;
  const newTopicsCount = Math.max(0, payload.currentCount - previousCount);

  return {
    slug: payload.slug,
    previousCount,
    currentCount: payload.currentCount,
    hasNewTopics: newTopicsCount > 0,
    newTopicsCount,
  };
}
