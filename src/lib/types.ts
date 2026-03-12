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
