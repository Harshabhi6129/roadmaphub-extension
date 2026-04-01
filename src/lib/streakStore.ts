export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  /** ISO date string (YYYY-MM-DD) of the last recorded commit */
  lastCommitDate: string;
  /** All unique commit dates (YYYY-MM-DD), sorted ascending */
  commitDates: string[];
}

const STREAK_KEY = 'roadmaphub_streak';

export async function getStreakData(): Promise<StreakData> {
  const r = await chrome.storage.local.get([STREAK_KEY]);
  return r[STREAK_KEY] || {
    currentStreak: 0,
    longestStreak: 0,
    lastCommitDate: '',
    commitDates: [],
  };
}

/**
 * Record today's activity and recalculate streak.
 * Safe to call multiple times in a day — idempotent for the same date.
 */
export async function recordCommitForStreak(): Promise<StreakData> {
  const today = new Date().toISOString().split('T')[0];
  const data = await getStreakData();

  // Already recorded today
  if (data.lastCommitDate === today) return data;

  const commitDates = Array.from(new Set([...data.commitDates, today])).sort();

  // Calculate current streak: walk backwards from today
  const streak = calculateCurrentStreak(commitDates);
  const longestStreak = Math.max(data.longestStreak, streak);

  const updated: StreakData = {
    currentStreak: streak,
    longestStreak,
    lastCommitDate: today,
    commitDates,
  };

  await chrome.storage.local.set({ [STREAK_KEY]: updated });
  return updated;
}

function calculateCurrentStreak(sortedDates: string[]): number {
  if (sortedDates.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Streak is only active if the last commit was today or yesterday
  const last = sortedDates[sortedDates.length - 1];
  if (last !== today && last !== yesterday) return 1;

  // Walk backwards from the most recent date
  let streak = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    const curr = new Date(sortedDates[i]);
    const prev = new Date(sortedDates[i - 1]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
