export interface RoadmapProgress {
  slug: string;
  displayName: string;
  completed: number;
  total: number;
  progressPercent: number;
  firstCommitDate: string;
  lastCommitDate: string;
  lastTopicName: string;
  lastTopicPath: string;
  committedSlugs: string[];
  syncedFromPage: boolean;
  officialTotal: number | null;
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

  // Take the higher of what the page reports vs what we have committed.
  // This handles mid-progress users correctly without losing either source of truth.
  const reconciledCompleted = existing
    ? Math.max(existing.completed, completed)
    : completed;

  store[slug] = {
    slug,
    displayName: existing?.displayName || displayName,
    completed: reconciledCompleted,
    total,
    progressPercent: computePercent(reconciledCompleted, total),
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

/**
 * Record a newly committed topic.
 *
 * Reconciliation rules (simplified):
 * - committedSlugs is always the dedup source of truth for extension commits.
 * - completed = max(page-reported, committedSlugs.length).
 *   For first-time users (no prior commits) we trust the page's number as
 *   the baseline so mid-progress users don't start from 1.
 */
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

  // Accumulate deduplicated committed slugs
  const committedSlugs = Array.from(
    new Set([...(existing?.committedSlugs || []), topicSlug])
  );

  // Determine completed count
  let completed: number;
  if (!existing || committedSlugs.length === 1) {
    // Very first commit: use page number as baseline (handles mid-progress users)
    completed = Math.max(pageCompleted, 1);
  } else {
    // Subsequent commits: take whichever is highest — page or our tracked count
    completed = Math.max(existing.completed + 1, committedSlugs.length, pageCompleted);
  }

  const total = pageTotal > 0
    ? pageTotal
    : (existing?.officialTotal || existing?.total || completed);

  store[slug] = {
    slug,
    displayName: displayName || existing?.displayName || slug,
    completed,
    total,
    progressPercent: computePercent(completed, total),
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

/**
 * Rebuild committedSlugs from a GitHub repo scan result.
 * Used on reinstall or first-time sync to recover previously committed topics.
 */
export async function rebuildFromGitHub(
  slugMap: Record<string, string[]>
): Promise<void> {
  const store = await getProgressStore();

  for (const [slug, slugs] of Object.entries(slugMap)) {
    const existing = store[slug];
    const merged = Array.from(new Set([...(existing?.committedSlugs || []), ...slugs]));
    const displayName = existing?.displayName || formatDisplayName(slug);

    const completed = Math.max(existing?.completed || 0, merged.length);
    const total = existing?.total || existing?.officialTotal || 0;

    store[slug] = {
      slug,
      displayName,
      completed,
      total,
      progressPercent: computePercent(completed, total),
      firstCommitDate: existing?.firstCommitDate || '',
      lastCommitDate: existing?.lastCommitDate || '',
      lastTopicName: existing?.lastTopicName || '',
      lastTopicPath: existing?.lastTopicPath || '',
      committedSlugs: merged,
      syncedFromPage: existing?.syncedFromPage || false,
      officialTotal: existing?.officialTotal || null,
    };
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

function computePercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((completed / total) * 100));
}

function formatDisplayName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Generate a markdown export of the full progress store.
 */
export function generateExportMarkdown(store: ProgressStore): string {
  const slugs = Object.keys(store)
    .filter(k => store[k].committedSlugs?.length > 0)
    .sort((a, b) => store[b].progressPercent - store[a].progressPercent);

  if (slugs.length === 0) return '# RoadmapHub — Learning Export\n\nNo topics committed yet.\n';

  const totalCommitted = slugs.reduce((s, k) => s + store[k].committedSlugs.length, 0);
  const date = new Date().toISOString().split('T')[0];

  let md = `# RoadmapHub — Learning Export\n\n`;
  md += `> Generated: ${date} | Total topics committed: **${totalCommitted}** across **${slugs.length}** roadmaps\n\n---\n\n`;

  for (const slug of slugs) {
    const r = store[slug];
    md += `## ${r.displayName} — ${r.progressPercent}% (${r.completed}/${r.total})\n\n`;
    if (r.committedSlugs.length > 0) {
      r.committedSlugs.forEach(ts => {
        const name = ts.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        md += `- [${name}](${slug}/${ts}.md)\n`;
      });
    }
    md += `\n`;
  }

  return md;
}
