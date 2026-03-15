import { LearningCommitPayload } from "@/lib/types";

export interface QueuedCommit {
  id: string;
  payload: LearningCommitPayload;
  markdown: string;
  timestamp: number;
  retries: number;
}

export async function addToQueue(payload: LearningCommitPayload, markdown: string) {
  const { commit_queue = [] } = await chrome.storage.local.get("commit_queue");
  const newCommit: QueuedCommit = {
    id: crypto.randomUUID(),
    payload,
    markdown,
    timestamp: Date.now(),
    retries: 0
  };
  
  await chrome.storage.local.set({ 
    commit_queue: [...commit_queue, newCommit] 
  });
  
  // Schedule an alarm to try processing soon
  chrome.alarms.create("process_queue", { delayInMinutes: 1 });
  console.log("[RoadmapHub] Added commit to offline queue:", payload.topic.topicName);
}

export async function getQueue(): Promise<QueuedCommit[]> {
  const { commit_queue = [] } = await chrome.storage.local.get("commit_queue");
  return commit_queue;
}

export async function removeFromQueue(id: string) {
  const queue = await getQueue();
  await chrome.storage.local.set({
    commit_queue: queue.filter(c => c.id !== id)
  });
}

export async function updateQueueRetry(id: string) {
  const queue = await getQueue();
  await chrome.storage.local.set({
    commit_queue: queue.map(c => c.id === id ? { ...c, retries: (c.retries || 0) + 1 } : c)
  });
}
