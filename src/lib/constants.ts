export const REPO_NAME = "dev-learning-log";

/**
 * GitHub OAuth App credentials.
 * Set these in your .env file (see .env.example).
 */
export const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || "";
export const GITHUB_CLIENT_SECRET = import.meta.env.VITE_GITHUB_CLIENT_SECRET || "";
export const GITHUB_SCOPES = "repo";

export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
export const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

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
} as const;
