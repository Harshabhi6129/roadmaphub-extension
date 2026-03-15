export const REPO_NAME = "dev-learning-log";

/**
 * GitHub OAuth App credentials.
 */
export const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || "";
export const GITHUB_SCOPES = "repo"; // This line was not explicitly removed in the example, keeping it.

/**
 * Cloudflare Worker Proxy for secure OAuth and AI calls.
 */
export const WORKER_BASE_URL = import.meta.env.VITE_WORKER_BASE_URL || ""; // Changed default value as per example
export const EXTENSION_SECRET = import.meta.env.VITE_EXTENSION_SECRET || ""; // Added as per instruction

export const GITHUB_API_URL = "https://api.github.com"; // Added as per example
export const GEMINI_API_URL = `${WORKER_BASE_URL}/gemini/enhance`;

/** Message types between content script <-> background worker */
export const MSG = {
  // Auth
  LOGIN_GITHUB: "LOGIN_GITHUB",
  LOGOUT_GITHUB: "LOGOUT_GITHUB",
  GET_AUTH_STATUS: "GET_AUTH_STATUS",

  // Commit
  COMMIT_LEARNING: "COMMIT_LEARNING",

  // AI
  AI_ENHANCE: "AI_ENHANCE",

  // Progress
  SYNC_PROGRESS: "SYNC_PROGRESS",
  CHECK_TOPIC_EXISTS: "CHECK_TOPIC_EXISTS",
} as const;
