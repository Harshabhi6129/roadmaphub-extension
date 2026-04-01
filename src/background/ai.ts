import { GEMINI_API_URL, EXTENSION_SECRET } from "@/lib/constants";
import type { AIEnhanceRequest, AIEnhanceResponse, TopicResource } from "@/lib/types";

/** Max characters allowed for user-supplied fields before they are truncated */
const MAX_FIELD_LENGTH = 500;

/**
 * Sanitize a user-supplied string for safe inclusion in an AI prompt.
 * - Truncates to prevent abuse / prompt injection via length
 * - Removes control characters
 * - Escapes characters that could break the surrounding JSON structure
 */
function sanitizeForPrompt(input: string): string {
  if (!input) return '';
  return input
    .slice(0, MAX_FIELD_LENGTH)
    .replace(/[\x00-\x1F\x7F]/g, ' ')   // remove control chars
    .replace(/["\\]/g, (c) => `\\${c}`)  // escape quotes and backslashes
    .trim();
}

/**
 * Call the Gemini API via Worker proxy to generate a structured learning summary.
 */
export async function enhanceWithAI(
  req: AIEnhanceRequest
): Promise<AIEnhanceResponse> {
  // Sanitize all user-supplied inputs before they enter the prompt
  const topicName = sanitizeForPrompt(req.topicName);
  const roadmapDomain = sanitizeForPrompt(req.roadmapDomain);
  const description = sanitizeForPrompt(req.description);
  const notes = sanitizeForPrompt(req.notes);

  const prompt = `You are a helpful developer learning assistant.
A user just completed a learning topic on roadmap.sh.

Topic: ${topicName}
Roadmap: ${roadmapDomain}
Description: ${description}
User Notes: ${notes || "(none)"}

Generate a JSON response with these fields:
- "summary": A concise 2-3 sentence summary of what this topic covers.
- "keyConcepts": An array of 3-5 key concepts as short bullet strings.
- "tags": An array of 2-4 relevant tags (lowercase, no #).

Return ONLY valid JSON with no markdown fences or extra text.`;

  const resp = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Extension-Secret": EXTENSION_SECRET,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    const detail = errBody?.error?.message || resp.statusText;
    throw new Error(`AI enhancement failed (${resp.status}): ${detail}`);
  }

  const data = await resp.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  return parseAIResponse(text);
}

function parseAIResponse(text: string): AIEnhanceResponse {
  // Strip markdown fences if Gemini wraps the response
  const cleaned = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as AIEnhanceResponse;
    // Validate shape — all three fields must be present
    if (
      typeof parsed.summary === 'string' &&
      Array.isArray(parsed.keyConcepts) &&
      Array.isArray(parsed.tags)
    ) {
      return parsed;
    }
    throw new Error('Invalid AI response shape');
  } catch {
    // Last-resort fallback so the panel never crashes
    return {
      summary: cleaned.slice(0, 300),
      keyConcepts: [],
      tags: [],
    };
  }
}

/**
 * Build the final markdown string from topic data + optional AI enhancement.
 */
export function buildMarkdown(
  topicName: string,
  roadmapDomain: string,
  roadmapSlug: string,
  description: string,
  notes: string,
  code: string,
  resources: TopicResource[],
  tags: string[],
  aiSummary?: string,
  aiKeyConcepts?: string[]
): string {
  const date = new Date().toISOString().split("T")[0];

  let md = `# ${topicName}\n\n`;
  md += `> **Roadmap:** [${roadmapDomain}](https://roadmap.sh/${roadmapSlug})  \n`;
  md += `> **Date Completed:** ${date}  \n`;
  md += `> **Source:** [roadmap.sh/${roadmapSlug}](https://roadmap.sh/${roadmapSlug})\n\n`;

  if (tags.length > 0) {
    md += `**Tags:** ${tags.map((t) => `\`${t}\``).join(", ")}\n\n`;
  }

  md += `---\n\n`;

  md += `## Summary\n\n`;
  md += `${aiSummary || description}\n\n`;

  if (aiKeyConcepts && aiKeyConcepts.length > 0) {
    md += `## Key Concepts\n\n`;
    aiKeyConcepts.forEach((c) => { md += `- ${c}\n`; });
    md += `\n`;
  }

  if (notes.trim()) {
    md += `## Personal Notes\n\n${notes}\n\n`;
  }

  if (code.trim()) {
    md += `## Code Example\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
  }

  if (resources.length > 0) {
    md += `## Resources\n\n`;
    const grouped: Record<string, TopicResource[]> = {};
    for (const r of resources) {
      const type = r.type || "article";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(r);
    }
    const typeLabels: Record<string, string> = {
      official: "📖 Official Documentation",
      article: "📝 Articles",
      video: "🎥 Videos",
      course: "🎓 Courses",
      book: "📚 Books",
    };
    for (const [type, items] of Object.entries(grouped)) {
      const label = typeLabels[type] || `📌 ${type.charAt(0).toUpperCase() + type.slice(1)}`;
      md += `### ${label}\n\n`;
      items.forEach((r) => { md += `- [${r.title}](${r.url})\n`; });
      md += `\n`;
    }
  }

  return md;
}
