import type { TopicMetadata, TopicResource } from "@/lib/types";

/**
 * Extract topic metadata from the currently open roadmap.sh topic modal.
 *
 * roadmap.sh renders topic details in a fixed right-side panel when a user
 * clicks on a roadmap SVG node. The modal is a `div.fixed.top-0.right-0`
 * with class `sm:max-w-[600px]`.
 *
 * This extractor is built from direct DOM inspection of the live site.
 */
export function extractTopicMetadata(): TopicMetadata | null {
  // --- 1. Determine roadmap slug from URL ---
  // URL pattern: https://roadmap.sh/backend  or  https://roadmap.sh/devops
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const roadmapSlug = pathParts[0] || "unknown";

  // --- 2. Find the topic modal ---
  // The modal is a fixed div on the right side of the screen.
  // It matches: div.fixed.top-0.right-0 with overflow-y-auto
  const modal = findTopicModal();
  if (!modal) {
    console.debug("[RoadmapHub] No topic modal open — ignoring trigger");
    return null;
  }

  // --- 3. Extract topic name from <h1> ---
  const h1 = modal.querySelector("h1");
  const topicName = h1?.textContent?.trim() || "Unknown Topic";

  // --- 4. Extract description ---
  // The first <p> after the heading is the description
  const paragraphs = modal.querySelectorAll("p");
  let description = "";
  for (const p of Array.from(paragraphs)) {
    const text = p.textContent?.trim();
    if (text && text.length > 20 && !text.startsWith("Visit the following")) {
      description = text;
      break;
    }
  }

  // --- 5. Extract categorized resource links ---
  const resources = extractResources(modal);

  // --- 6. Try to get node ID from the recently-clicked SVG node ---
  const { nodeId, topicSlug: slugFromNode } = getActiveNodeInfo();

  // Derive topic slug: from the node data, or fallback to slugifying the title
  const topicSlug = slugFromNode || slugifyTopic(topicName);

  return {
    topicName,
    roadmapSlug,
    roadmapDomain: formatDomain(roadmapSlug),
    nodeId,
    topicSlug,
    description,
    resources,
    pageUrl: window.location.href,
    totalTopics: countTotalTopics(),
  };
}

/**
 * Find the topic detail modal on roadmap.sh.
 * It's a fixed-position panel that slides in from the right.
 */
function findTopicModal(): Element | null {
  // Primary: look for the fixed right-side panel with content
  const fixedDivs = document.querySelectorAll("div.fixed");
  for (const div of Array.from(fixedDivs)) {
    const classes = div.className || "";
    // The modal has top-0, right-0, and typically contains an h1
    if (
      (classes.includes("top-0") && classes.includes("right-0")) ||
      (classes.includes("top-0") && div.querySelector("h1"))
    ) {
      const style = window.getComputedStyle(div);
      if (style.display !== "none" && style.visibility !== "hidden") {
        // Verify it actually has content (h1)
        if (div.querySelector("h1")) {
          return div;
        }
      }
    }
  }

  // Fallback: any fixed/absolute element with an h1 and resource links
  const candidates = document.querySelectorAll(
    'div[class*="fixed"], div[class*="overlay"], div[role="dialog"]'
  );
  for (const el of Array.from(candidates)) {
    const style = window.getComputedStyle(el);
    if (
      (style.position === "fixed" || style.position === "absolute") &&
      style.display !== "none" &&
      el.querySelector("h1") &&
      el.querySelectorAll("a[href]").length > 0
    ) {
      return el;
    }
  }

  return null;
}

/**
 * Extract categorized resource links from the modal.
 *
 * roadmap.sh topic content has links with type prefixes:
 *   - [@article@Title](url)
 *   - [@video@Title](url)
 *   - [@course@Title](url)
 *   - [@official@Title](url)
 *   - [@book@Title](url)
 *
 * In the rendered DOM, resource type appears as a badge/span before the link text.
 */
function extractResources(modal: Element): TopicResource[] {
  const resources: TopicResource[] = [];
  const seenUrls = new Set<string>();

  // Find all links in the modal
  const links = modal.querySelectorAll("a[href]");

  for (const link of Array.from(links)) {
    const anchor = link as HTMLAnchorElement;
    const href = anchor.href;

    // Skip internal roadmap.sh links, hash links, and javascript:
    if (
      !href ||
      href.startsWith("javascript:") ||
      href.includes("roadmap.sh/signup") ||
      href.includes("roadmap.sh/login") ||
      seenUrls.has(href)
    ) {
      continue;
    }

    // Extract resource type from badge/span element
    const typeSpan = anchor.querySelector("span");
    let resourceType = "article"; // default

    if (typeSpan) {
      const spanText = typeSpan.textContent?.trim().toLowerCase() || "";
      if (spanText.includes("video")) resourceType = "video";
      else if (spanText.includes("course")) resourceType = "course";
      else if (spanText.includes("official")) resourceType = "official";
      else if (spanText.includes("book")) resourceType = "book";
      else if (spanText.includes("article")) resourceType = "article";
    } else {
      // Infer from URL
      if (href.includes("youtube.com") || href.includes("youtu.be")) {
        resourceType = "video";
      } else if (href.includes("udemy.com") || href.includes("coursera.org")) {
        resourceType = "course";
      }
    }

    // Extract the visible link text (excluding the type badge)
    let title = anchor.textContent?.trim() || href;
    // Remove type prefix text if it's embedded in the link text
    if (typeSpan?.textContent) {
      title = title.replace(typeSpan.textContent, "").trim();
    }

    if (title && href) {
      seenUrls.add(href);
      resources.push({ type: resourceType, title, url: href });
    }
  }

  return resources;
}

/**
 * Try to get the node ID and slug from the most recently clicked SVG node.
 *
 * On roadmap.sh, roadmap nodes are SVG <g> elements with:
 *   data-node-id="qSAdfaGUfn8mtmDjHJi3z"
 *   data-title="ACID"
 *   data-type="topic" | "subtopic"
 */
function getActiveNodeInfo(): { nodeId: string; topicSlug: string } {
  // Look for a node with a "done" visual indicator (recently toggled)
  // Or try to match the h1 text to a node's data-title

  const modal = findTopicModal();
  const topicTitle = modal?.querySelector("h1")?.textContent?.trim() || "";

  // Search all SVG group nodes for a matching title
  const nodes = document.querySelectorAll("g[data-node-id]");
  for (const node of Array.from(nodes)) {
    const nodeTitle = node.getAttribute("data-title") || "";
    if (
      nodeTitle.toLowerCase() === topicTitle.toLowerCase() ||
      nodeTitle.toLowerCase().includes(topicTitle.toLowerCase())
    ) {
      const nodeId = node.getAttribute("data-node-id") || "";
      const slug = slugifyTopic(nodeTitle);
      return { nodeId, topicSlug: slug };
    }
  }

  return { nodeId: "", topicSlug: slugifyTopic(topicTitle) };
}

/**
 * Convert a topic name to a URL/file slug.
 * e.g. "ACID Properties" → "acid-properties"
 */
function slugifyTopic(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Count total topics available in the current roadmap.
 * roadmap.sh uses <g> elements with data-type="topic" for roadmap nodes.
 */
function countTotalTopics(): number {
  // Topics are usually group elements with data-type="topic"
  const topics = document.querySelectorAll('g[data-node-id][data-type="topic"]');
  if (topics.length > 0) return topics.length;

  // Fallback: count all group elements with a data-node-id and data-title
  // as some roadmaps might have slightly different data-type values
  const nodes = document.querySelectorAll('g[data-node-id][data-title]');
  return nodes.length || 0;
}

/**
 * Convert a roadmap slug to a human-readable domain name.
 * e.g. "backend" → "Backend", "ai-engineer" → "AI Engineer"
 */
function formatDomain(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
