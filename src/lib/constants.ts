export const REPO_NAME = "dev-learning-log";

/**
 * GitHub OAuth App credentials.
 */
export const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || "";
export const GITHUB_SCOPES = "repo";

/**
 * Cloudflare Worker Proxy for secure OAuth and AI calls.
 */
export const WORKER_BASE_URL = import.meta.env.VITE_WORKER_BASE_URL || "";
export const EXTENSION_SECRET = import.meta.env.VITE_EXTENSION_SECRET || "";

export const GEMINI_API_URL = `${WORKER_BASE_URL}/gemini/enhance`;

/** Message types between content script <-> background worker */
export const MSG = {
  // Auth
  LOGIN_GITHUB: "LOGIN_GITHUB",
  LOGOUT_GITHUB: "LOGOUT_GITHUB",
  GET_AUTH_STATUS: "GET_AUTH_STATUS",

  // Commit
  COMMIT_LEARNING: "COMMIT_LEARNING",
  BULK_COMMIT: "BULK_COMMIT",

  // AI
  AI_ENHANCE: "AI_ENHANCE",

  // Progress
  SYNC_PROGRESS: "SYNC_PROGRESS",
  CHECK_TOPIC_EXISTS: "CHECK_TOPIC_EXISTS",

  // GitHub sync (reinstall recovery)
  SYNC_FROM_GITHUB: "SYNC_FROM_GITHUB",

  // Settings
  GET_SETTINGS: "GET_SETTINGS",
  SAVE_SETTINGS: "SAVE_SETTINGS",

  // Streak
  GET_STREAK: "GET_STREAK",

  // Export
  EXPORT_NOTES: "EXPORT_NOTES",

  // Changelog detection
  CHECK_ROADMAP_UPDATES: "CHECK_ROADMAP_UPDATES",
} as const;

/** Human-readable error messages for GitHub API responses */
export const GITHUB_ERRORS: Record<number, string> = {
  401: "GitHub token expired. Please sign out and reconnect.",
  403: "GitHub rate limit reached or insufficient permissions. Try again in a few minutes.",
  404: "Repository or file not found. It may have been deleted.",
  409: "Conflict: the file was modified externally. Please try again.",
  422: "GitHub rejected the request (validation error). Check your repo settings.",
  429: "Too many requests. Please wait a moment before trying again.",
  500: "GitHub server error. Try again in a few minutes.",
  503: "GitHub is temporarily unavailable. Try again shortly.",
};
