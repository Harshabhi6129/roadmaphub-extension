import { getQueue, removeFromQueue, updateQueueRetry } from "./queue";
import { commitLearning } from "./github";

export function setupAlarms() {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "process_queue") {
      await processQueue();
    }
  });

  // Regular check every 30 minutes just in case
  chrome.alarms.create("periodic_process", { periodInMinutes: 30 });
}

async function processQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return;

  console.log(`[RoadmapHub] Processing queue (${queue.length} items)...`);

  const { gh_token } = await chrome.storage.local.get("gh_token");
  if (!gh_token) {
    console.debug("[RoadmapHub] Process queue skipped: No GitHub token.");
    return;
  }

  for (const item of queue) {
    if (item.retries > 5) {
      console.warn(`[RoadmapHub] Dropping commit ${item.id} after 5 retries.`, item.payload.topic.topicName);
      await removeFromQueue(item.id);
      continue;
    }

    try {
      // commitLearning returns the URL on success, throws on error
      const url = await commitLearning(gh_token, item.payload, item.markdown);
      console.log(`[RoadmapHub] Successfully flushed queued commit: ${url}`);
      await removeFromQueue(item.id);
    } catch (e) {
      console.error(`[RoadmapHub] Failed to flush queued commit ${item.id}:`, e);
      await updateQueueRetry(item.id);
    }
  }
}
