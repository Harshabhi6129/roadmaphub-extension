import type { TopicMetadata, TopicResource } from "@/lib/types";
import { slugify } from "@/lib/utils";

/**
 * Extract topic metadata from the currently open roadmap.sh topic modal.
 */
export function extractTopicMetadata(): TopicMetadata | null {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const roadmapSlug = pathParts[0] || "unknown";

  const modal = findTopicModal();
  if (!modal) {
    console.warn("[RoadmapHub] ❌ No topic modal found in the DOM.");
    return null;
  }

  console.log("[RoadmapHub] 🔍 Found modal:", modal.tagName, modal.className);

  const h1 = modal.querySelector("h1");
  const topicName = h1?.textContent?.trim() || "Unknown Topic";

  // Description extraction improvements: Look for the first substantial paragraph
  const paragraphs = modal.querySelectorAll("p, .prose p");
  let description = "";
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim();
    if (text && text.length > 20 && !text.startsWith("Visit")) {
      description = text;
      break;
    }
  }

  const resources = extractResources(modal);
  const { nodeId, topicSlug: slugFromNode } = getActiveNodeInfo();
  const topicSlug = slugFromNode || slugify(topicName);
  
  const progress = scrapedProgress();

  return {
    topicName,
    roadmapSlug,
    roadmapDomain: formatDomain(roadmapSlug),
    nodeId,
    topicSlug,
    description,
    resources,
    pageUrl: window.location.href,
    totalTopics: progress.total,
    completedTopics: progress.completed,
    progressPercent: progress.percent,
  };
}

/**
 * Find the topic detail modal with better heuristics.
 */
function findTopicModal(): Element | null {
  // 1. Explicit Data Test IDs (Very high confidence)
  const testIdModal = document.querySelector('[data-testid="topic-detail"], [data-testid="resource-modal"]');
  if (testIdModal) return testIdModal;

  // 2. The standard roadmap.sh side-panel (Most common)
  const fixedSidePanel = document.querySelector("div.fixed.top-0.right-0");
  if (fixedSidePanel && fixedSidePanel.querySelector("h1")) {
    // Basic verification it's not a generic overlay
    const text = fixedSidePanel.textContent?.toLowerCase() || "";
    if (text.includes("completed") || text.includes("resources") || text.includes("visit")) {
      return fixedSidePanel;
    }
  }

  // 3. Fallback: Any dialog/modal that looks like a topic detail
  const modals = document.querySelectorAll('[role="dialog"], [aria-modal="true"], div.fixed.inset-0');
  for (const modal of Array.from(modals)) {
    const hasHeader = modal.querySelector("h1");
    const text = modal.textContent?.toLowerCase() || "";
    const isTopicLike = text.includes("completed") || text.includes("mark as done") || text.includes("resources");
    
    if (hasHeader && isTopicLike) {
      const style = window.getComputedStyle(modal);
      if (style.display !== "none" && style.visibility !== "hidden") return modal;
    }
  }

  return null;
}

/**
 * Extract Resources with better type detection.
 */
function extractResources(modal: Element): TopicResource[] {
  const resources: TopicResource[] = [];
  const seenUrls = new Set<string>();
  const links = modal.querySelectorAll("a[href]");

  for (const link of Array.from(links)) {
    const anchor = link as HTMLAnchorElement;
    const href = anchor.href;

    if (!href || href.startsWith("javascript:") || href.includes("roadmap.sh/signup") || seenUrls.has(href)) {
      continue;
    }

    // Heuristic 1: Badge Text
    const badge = anchor.querySelector("span, .badge");
    const badgeText = badge?.textContent?.trim().toLowerCase() || "";
    
    // Heuristic 2: Title Text (e.g. "Video: Intro to X")
    const fullText = anchor.textContent?.trim().toLowerCase() || "";
    
    let type = "article";
    if (badgeText.includes("video") || fullText.includes("video:") || href.includes("youtube.com") || href.includes("youtu.be")) type = "video";
    else if (badgeText.includes("course") || href.includes("udemy.com") || href.includes("coursera.org")) type = "course";
    else if (badgeText.includes("official") || badgeText.includes("docs")) type = "official";
    else if (badgeText.includes("book") || fullText.includes("book:")) type = "book";

    let title = anchor.innerText.trim();
    if (badge?.textContent) {
      title = title.replace(badge.textContent, "").trim();
    }
    // Clean up common prefixes
    title = title.replace(/^(video|article|course|official|book):\s*/i, "");

    if (title && href) {
      seenUrls.add(href);
      resources.push({ type, title, url: href });
    }
  }
  return resources;
}

function getActiveNodeInfo(): { nodeId: string; topicSlug: string } {
  const modal = findTopicModal();
  const topicTitle = modal?.querySelector("h1")?.textContent?.trim() || "";
  const nodes = document.querySelectorAll("g[data-node-id]");
  
  for (const node of Array.from(nodes)) {
    const nodeTitle = node.getAttribute("data-title") || "";
    if (nodeTitle.toLowerCase() === topicTitle.toLowerCase()) {
      return { 
        nodeId: node.getAttribute("data-node-id") || "", 
        topicSlug: slugify(nodeTitle) 
      };
    }
  }
  return { nodeId: "", topicSlug: slugify(topicTitle) };
}

/**
 * Scrape current progress from the page (N of M Done).
 */
export function scrapedProgress(): { completed: number; total: number; percent: number } {
  // 1. Native indicator (Most reliable for whole roadmap)
  const bodyText = document.body.innerText;
  const match = bodyText.match(/(\d+)\s+of\s+(\d+)\s+Done/i);
  
  if (match) {
    const completed = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (!isNaN(completed) && !isNaN(total)) {
      return { 
        completed, 
        total, 
        percent: total > 0 ? Math.round((completed / total) * 100) : 0 
      };
    }
  }

  // 2. SVG Node Count (Fallback)
  const topics = document.querySelectorAll('g[data-node-id][data-type="topic"]').length;
  const subtopics = document.querySelectorAll('g[data-node-id][data-type="subtopic"]').length;
  const total = topics + subtopics;
  
  // Try to find completed nodes (they have a specific SVG path or color usually, 
  // but roadmap.sh changes this often. For now, we rely on the text indicator primarily)
  return { completed: 0, total: total || 0, percent: 0 };
}

function formatDomain(slug: string): string {
  return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
