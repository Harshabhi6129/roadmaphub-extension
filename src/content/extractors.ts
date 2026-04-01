import type { TopicMetadata, TopicResource } from "@/lib/types";
import { slugify } from "@/lib/utils";

/**
 * Extract metadata from the currently open roadmap.sh topic modal.
 */
export function extractTopicMetadata(): TopicMetadata | null {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const roadmapSlug = pathParts[0] || "unknown";

  const modal = findTopicModal();
  if (!modal) {
    console.warn("[RoadmapHub] No topic modal found in the DOM.");
    return null;
  }

  const h1 = modal.querySelector("h1");
  const topicName = h1?.textContent?.trim() || "Unknown Topic";

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
  const { nodeId, topicSlug: slugFromNode } = getActiveNodeInfo(topicName);
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
 * Extract all completed topics from the current roadmap page for bulk commit.
 * Looks for SVG nodes that roadmap.sh marks as done (green/checked).
 * Falls back to page-text-based detection.
 */
export function extractAllCompletedTopics(): TopicMetadata[] {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const roadmapSlug = pathParts[0] || "unknown";
  const roadmapDomain = formatDomain(roadmapSlug);
  const progress = scrapedProgress();
  const topics: TopicMetadata[] = [];
  const seen = new Set<string>();

  // Strategy 1: Look for SVG nodes with a "done" data attribute
  const doneNodes = document.querySelectorAll(
    'g[data-node-id][data-done="true"], g[data-node-id][data-status="done"], g[data-node-id].done'
  );

  for (const node of Array.from(doneNodes)) {
    const nodeId = node.getAttribute("data-node-id") || "";
    const title = node.getAttribute("data-title") || node.getAttribute("title") || "";
    if (!title || seen.has(nodeId)) continue;
    seen.add(nodeId);

    const topicSlug = slugify(title);
    topics.push({
      topicName: title,
      roadmapSlug,
      roadmapDomain,
      nodeId,
      topicSlug,
      description: "",
      resources: [],
      pageUrl: window.location.href,
      totalTopics: progress.total,
      completedTopics: progress.completed,
      progressPercent: progress.percent,
    });
  }

  // Strategy 2: Look for nodes with a green fill that indicates completion
  // roadmap.sh uses specific fill colors for completed nodes
  if (topics.length === 0) {
    const allNodes = document.querySelectorAll("g[data-node-id]");
    for (const node of Array.from(allNodes)) {
      const nodeEl = node as SVGElement;
      const nodeId = nodeEl.getAttribute("data-node-id") || "";
      const title =
        nodeEl.getAttribute("data-title") ||
        nodeEl.getAttribute("title") ||
        nodeEl.querySelector("text")?.textContent?.trim() ||
        "";
      if (!title || seen.has(nodeId)) continue;

      // Check if any child rect/path has a green-ish fill
      const shapes = nodeEl.querySelectorAll("rect, path, circle");
      let isDone = false;
      for (const shape of Array.from(shapes)) {
        const fill = shape.getAttribute("fill") || "";
        const style = (shape as HTMLElement).style?.fill || "";
        const color = fill || style;
        // Common "done" colors in roadmap.sh: green variants
        if (
          color.startsWith("#5b") || // #5bc4af etc.
          color.startsWith("#4c") ||
          color === "green" ||
          color.includes("rgb(91") ||
          color.includes("rgb(76")
        ) {
          isDone = true;
          break;
        }
      }

      if (!isDone) continue;
      seen.add(nodeId);
      topics.push({
        topicName: title,
        roadmapSlug,
        roadmapDomain,
        nodeId,
        topicSlug: slugify(title),
        description: "",
        resources: [],
        pageUrl: window.location.href,
        totalTopics: progress.total,
        completedTopics: progress.completed,
        progressPercent: progress.percent,
      });
    }
  }

  return topics;
}

// ========== Internal helpers ==========

function findTopicModal(): Element | null {
  // 1. Explicit test IDs
  const testIdModal = document.querySelector(
    '[data-testid="topic-detail"], [data-testid="resource-modal"]'
  );
  if (testIdModal) return testIdModal;

  // 2. Standard roadmap.sh side-panel
  const fixedSidePanel = document.querySelector("div.fixed.top-0.right-0");
  if (fixedSidePanel && fixedSidePanel.querySelector("h1")) {
    const text = fixedSidePanel.textContent?.toLowerCase() || "";
    if (text.includes("completed") || text.includes("resources") || text.includes("visit")) {
      return fixedSidePanel;
    }
  }

  // 3. Any visible dialog with a topic-like structure
  const modals = document.querySelectorAll(
    '[role="dialog"], [aria-modal="true"], div.fixed.inset-0'
  );
  for (const modal of Array.from(modals)) {
    const hasHeader = modal.querySelector("h1");
    const text = modal.textContent?.toLowerCase() || "";
    const isTopicLike =
      text.includes("completed") ||
      text.includes("mark as done") ||
      text.includes("resources");
    if (hasHeader && isTopicLike) {
      const style = window.getComputedStyle(modal);
      if (style.display !== "none" && style.visibility !== "hidden") return modal;
    }
  }

  return null;
}

function extractResources(modal: Element): TopicResource[] {
  const resources: TopicResource[] = [];
  const seenUrls = new Set<string>();

  for (const link of Array.from(modal.querySelectorAll("a[href]"))) {
    const anchor = link as HTMLAnchorElement;
    const href = anchor.href;

    if (
      !href ||
      href.startsWith("javascript:") ||
      href.includes("roadmap.sh/signup") ||
      seenUrls.has(href)
    ) {
      continue;
    }

    const badge = anchor.querySelector("span, .badge");
    const badgeText = badge?.textContent?.trim().toLowerCase() || "";
    const fullText = anchor.textContent?.trim().toLowerCase() || "";

    let type = "article";
    if (
      badgeText.includes("video") ||
      fullText.includes("video:") ||
      href.includes("youtube.com") ||
      href.includes("youtu.be")
    ) type = "video";
    else if (
      badgeText.includes("course") ||
      href.includes("udemy.com") ||
      href.includes("coursera.org")
    ) type = "course";
    else if (badgeText.includes("official") || badgeText.includes("docs")) type = "official";
    else if (badgeText.includes("book") || fullText.includes("book:")) type = "book";

    let title = anchor.innerText.trim();
    if (badge?.textContent) title = title.replace(badge.textContent, "").trim();
    title = title.replace(/^(video|article|course|official|book):\s*/i, "");

    if (title && href) {
      seenUrls.add(href);
      resources.push({ type, title, url: href });
    }
  }

  return resources;
}

function getActiveNodeInfo(topicTitle: string): { nodeId: string; topicSlug: string } {
  const nodes = document.querySelectorAll("g[data-node-id]");
  for (const node of Array.from(nodes)) {
    const nodeTitle = node.getAttribute("data-title") || "";
    if (nodeTitle.toLowerCase() === topicTitle.toLowerCase()) {
      return {
        nodeId: node.getAttribute("data-node-id") || "",
        topicSlug: slugify(nodeTitle),
      };
    }
  }
  return { nodeId: "", topicSlug: slugify(topicTitle) };
}

export function scrapedProgress(): { completed: number; total: number; percent: number } {
  const bodyText = document.body.innerText;
  const match = bodyText.match(/(\d+)\s+of\s+(\d+)\s+Done/i);

  if (match) {
    const completed = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);
    if (!isNaN(completed) && !isNaN(total)) {
      return {
        completed,
        total,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
      };
    }
  }

  // SVG fallback
  const topics = document.querySelectorAll('g[data-node-id][data-type="topic"]').length;
  const subtopics = document.querySelectorAll('g[data-node-id][data-type="subtopic"]').length;
  const total = topics + subtopics;
  return { completed: 0, total, percent: 0 };
}

function formatDomain(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
