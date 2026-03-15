import { MSG } from "./constants";

/** Shared types used across content, background, and popup scripts */

/** A single categorized resource link from roadmap.sh */
export interface TopicResource {
  /** e.g. "article", "video", "course", "official", "book" */
  type: string;
  title: string;
  url: string;
}

export interface TopicMetadata {
  /** e.g. "ACID", "Caching" */
  topicName: string;
  /** The URL slug of the roadmap, e.g. "backend", "frontend", "devops" */
  roadmapSlug: string;
  /** Human-readable roadmap name, e.g. "Backend" */
  roadmapDomain: string;
  /** The roadmap.sh node ID from data-node-id, e.g. "qSAdfaGUfn8mtmDjHJi3z" */
  nodeId: string;
  /** The topic slug derived from the node, e.g. "acid" */
  topicSlug: string;
  /** Description paragraph from the topic modal */
  description: string;
  /** Categorized resource links extracted from the topic modal */
  resources: TopicResource[];
  /** Current page URL */
  pageUrl: string;
  /** Total number of topics in the current roadmap */
  totalTopics: number;
  /** Number of topics already completed on the page */
  completedTopics: number;
  /** Progress percentage scraped from the page */
  progressPercent: number;
}

export interface LearningCommitPayload {
  topic: TopicMetadata;
  notes: string;
  code: string;
  tags: string[];
  commitMessage: string;
  practiceFiles: PracticeFile[];
}

export interface PracticeFile {
  name: string;
  /** base64 encoded content */
  content: string;
}

export interface AIEnhanceRequest {
  topicName: string;
  roadmapDomain: string;
  description: string;
  notes: string;
}

export interface AIEnhanceResponse {
  summary: string;
  keyConcepts: string[];
  tags: string[];
}

export interface AuthStatus {
  isLoggedIn: boolean;
  username?: string;
  avatarUrl?: string;
}

/**
 * Type-safe message union for chrome.runtime messaging
 */
export type TypedExtensionMessage =
  | { type: typeof MSG.GET_AUTH_STATUS; payload?: never }
  | { type: typeof MSG.LOGIN_GITHUB; payload?: never }
  | { type: typeof MSG.LOGOUT_GITHUB; payload?: never }
  | { type: typeof MSG.AI_ENHANCE; payload: AIEnhanceRequest }
  | { type: typeof MSG.COMMIT_LEARNING; payload: LearningCommitPayload }
  | { type: typeof MSG.SYNC_PROGRESS; payload: { slug: string; completed: number; total: number; displayName: string } }
  | { type: typeof MSG.CHECK_TOPIC_EXISTS; payload: { slug: string; topicSlug: string } };
