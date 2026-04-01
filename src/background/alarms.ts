import { getQueue, removeFromQueue, updateQueueRetry } from "./queue";
import { commitLearning, updateReadme } from "./github";
import { recordCommit, getProgressStore } from "@/lib/progressStore";
import { recordCommitForStreak } from "@/lib/streakStore";
import { getOfficialTopicCount } from "@/lib/roadmapData";
import { getSettings } from "@/lib/settings";

export function setupAlarms() {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === "process_queue" || alarm.name === "periodic_process") {
      await processQueue();
    }
  });

  // Regular check every 30 minutes
  chrome.alarms.create("periodic_process", { periodInMinutes: 30 });
}

async function processQueue() {
  const queue = await getQueue();
  if (queue.length === 0) return;

  console.log(`[RoadmapHub] Processing queue (${queue.length} items)...`);

  const { gh_token } = await chrome.storage.local.get("gh_token");
  if (!gh_token) {
    console.debug("[RoadmapHub] Queue skipped: no GitHub token.");
    return;
  }

  const settings = await getSettings();

  for (const item of queue) {
    if (item.retries > 5) {
      console.warn(
        `[RoadmapHub] Dropping queued commit after 5 retries:`,
        item.payload.topic.topicName
      );
      await removeFromQueue(item.id);
      continue;
    }

    try {
      const url = await commitLearning(
        gh_token,
        item.payload,
        item.markdown,
        settings.repoName
      );
      console.log(`[RoadmapHub] Flushed queued commit: ${url}`);
      await removeFromQueue(item.id);

      // Run the same post-commit work as the live path:
      // update progress store, README, and streak
      (async () => {
        try {
          const { topic } = item.payload;
          const officialCount = await getOfficialTopicCount(topic.roadmapSlug, gh_token);

          const fullStore = await recordCommit(
            topic.roadmapSlug,
            topic.topicSlug,
            topic.topicName,
            `${topic.roadmapSlug}/${topic.topicSlug}.md`,
            topic.roadmapDomain,
            topic.completedTopics,
            officialCount || topic.totalTopics
          );

          await recordCommitForStreak();

          const { gh_username } = await chrome.storage.local.get("gh_username");
          await updateReadme(gh_token, gh_username, fullStore, settings.repoName);
        } catch (bgErr) {
          console.error("[RoadmapHub] Post-queue sync failed:", bgErr);
        }
      })();
    } catch (e) {
      console.error(`[RoadmapHub] Failed to flush queued commit ${item.id}:`, e);
      await updateQueueRetry(item.id);
    }
  }
}
