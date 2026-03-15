const CACHE_KEY = 'official_topic_counts';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CountCache {
  counts: Record<string, number>;
  fetchedAt: number;
}

export async function getOfficialTopicCount(slug: string): Promise<number | null> {
  // Check cache first
  const cached = await chrome.storage.local.get([CACHE_KEY]);
  const cache: CountCache = cached[CACHE_KEY] || { counts: {}, fetchedAt: 0 };
  
  const isStale = Date.now() - cache.fetchedAt > CACHE_TTL_MS;
  if (!isStale && cache.counts[slug] !== undefined) {
    return cache.counts[slug] === -1 ? null : cache.counts[slug];
  }
  
  try {
    // roadmap.sh stores one .md file per topic in this directory
    // Each file = one learnable topic
    const url = `https://api.github.com/repos/kamranahmedse/developer-roadmap/contents/src/data/roadmaps/${slug}/content`;
    const resp = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    
    if (resp.status === 404) {
      // This slug doesn't have a content directory (some roadmaps are image-only)
      cache.counts[slug] = -1; // sentinel: "no data available"
      await chrome.storage.local.set({ [CACHE_KEY]: { ...cache, fetchedAt: Date.now() } });
      return null;
    }
    
    if (!resp.ok) return null;
    
    const files = await resp.json();
    if (!Array.isArray(files)) return null;
    
    // Count only .md files at the root of /content/ (not subdirectories)
    const count = files.filter((f: { name: string; type: string }) =>
      f.type === 'file' && f.name.endsWith('.md') && f.name !== 'index.md'
    ).length;
    
    cache.counts[slug] = count;
    await chrome.storage.local.set({ [CACHE_KEY]: { counts: cache.counts, fetchedAt: Date.now() } });
    
    return count > 0 ? count : null;
  } catch {
    return null;
  }
}
