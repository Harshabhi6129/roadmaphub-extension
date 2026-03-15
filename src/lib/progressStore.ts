export interface RoadmapProgress {
  slug: string;
  displayName: string;
  completed: number;          // topics the extension has seen (or reconciled from page)
  total: number;              // from page scrape or GitHub API fallback
  progressPercent: number;    // always Math.round((completed/total)*100), clamped 0-100
  firstCommitDate: string;    // ISO date "YYYY-MM-DD", set once
  lastCommitDate: string;     // ISO date, updated on every commit
  lastTopicName: string;      // e.g. "ACID Properties"
  lastTopicPath: string;      // e.g. "backend/acid.md"
  committedSlugs: string[];   // all topicSlugs ever committed, for dedup
  syncedFromPage: boolean;    // true if we have page-scraped baseline data
  officialTotal: number | null; // from GitHub API, null if not fetched yet
}

export type ProgressStore = Record<string, RoadmapProgress>;
const STORAGE_KEY = 'roadmap_progress';

export async function getProgressStore(): Promise<ProgressStore> {
  const r = await chrome.storage.local.get([STORAGE_KEY]);
  return r[STORAGE_KEY] || {};
}

export async function syncProgressFromPage(
  slug: string,
  completed: number,
  total: number,
  displayName: string
): Promise<void> {
  const store = await getProgressStore();
  const existing = store[slug];
  const reconciledCompleted = (existing?.committedSlugs?.length || 0) > 0 
    ? Math.max(existing.completed, completed)  // take the higher number
    : completed;

  store[slug] = {
    slug,
    displayName: existing?.displayName || displayName,
    completed: reconciledCompleted,
    total,
    progressPercent: total > 0 ? Math.min(100, Math.round((reconciledCompleted / total) * 100)) : 0,
    firstCommitDate: existing?.firstCommitDate || '',
    lastCommitDate: existing?.lastCommitDate || '',
    lastTopicName: existing?.lastTopicName || '',
    lastTopicPath: existing?.lastTopicPath || '',
    committedSlugs: existing?.committedSlugs || [],
    syncedFromPage: true,
    officialTotal: existing?.officialTotal || null,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

export async function recordCommit(
  slug: string,
  topicSlug: string,
  topicName: string,
  topicPath: string,
  displayName: string,
  pageCompleted: number,
  pageTotal: number
): Promise<ProgressStore> {
  const store = await getProgressStore();
  const existing = store[slug];
  const today = new Date().toISOString().split('T')[0];
  
  const committedSlugs = existing?.committedSlugs || [];
  if (!committedSlugs.includes(topicSlug)) committedSlugs.push(topicSlug);
  
  // Reconcile: if we have no prior commits, trust the page's completed count
  // as the baseline (handles mid-progress users)
  const reconciledCompleted = (!existing || (existing.committedSlugs?.length || 0) === 0)
    ? Math.max(pageCompleted, 1)
    : Math.max(existing.completed + 1, committedSlugs.length);
  
  const reconciledTotal = pageTotal > 0 
    ? pageTotal 
    : (existing?.officialTotal || existing?.total || reconciledCompleted);
  
  store[slug] = {
    slug,
    displayName: displayName || existing?.displayName || slug,
    completed: reconciledCompleted,
    total: reconciledTotal,
    progressPercent: Math.min(100, Math.round((reconciledCompleted / reconciledTotal) * 100)),
    firstCommitDate: existing?.firstCommitDate || today,
    lastCommitDate: today,
    lastTopicName: topicName,
    lastTopicPath: topicPath,
    committedSlugs,
    syncedFromPage: existing?.syncedFromPage || false,
    officialTotal: existing?.officialTotal || null,
  };
  
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
  return store;
}
