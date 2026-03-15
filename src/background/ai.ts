import { GEMINI_API_URL, EXTENSION_SECRET } from "@/lib/constants";
import type { AIEnhanceRequest, AIEnhanceResponse, TopicResource } from "@/lib/types";

/**
 * Call the Gemini API to generate a structured learning summary.
 */
export async function enhanceWithAI(
  req: AIEnhanceRequest
): Promise<AIEnhanceResponse> {
  const prompt = `You are a helpful developer learning assistant.
A user just completed a learning topic on roadmap.sh.

Topic: ${req.topicName}
Roadmap: ${req.roadmapDomain}
Description: ${req.description}
User Notes: ${req.notes || "(none)"}

Generate a JSON response with these fields:
- "summary": A concise 2-3 sentence summary of what this topic covers.
- "keyConcepts": An array of 3-5 key concepts as short bullet strings.
- "tags": An array of 2-4 relevant tags (lowercase, no #).

Return ONLY valid JSON with no markdown fences or extra text.`;

  const resp = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Extension-Secret": EXTENSION_SECRET
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    const detail = errBody?.error?.message || resp.statusText;
    throw new Error(`Gemini API error (${resp.status}): ${detail}`);
  }

  const data = await resp.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    return JSON.parse(text) as AIEnhanceResponse;
  } catch {
    // If Gemini wraps it in markdown fences, strip them
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    return JSON.parse(cleaned) as AIEnhanceResponse;
  }
}

/**
 * Build the final markdown string from topic data + optional AI enhancement.
 *
 * Uses the real roadmap.sh data structure with categorized resources.
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
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  let md = `# ${topicName}\n\n`;
  md += `> **Roadmap:** [${roadmapDomain}](https://roadmap.sh/${roadmapSlug})  \n`;
  md += `> **Date Completed:** ${date}  \n`;
  md += `> **Source:** [roadmap.sh/${roadmapSlug}](https://roadmap.sh/${roadmapSlug})\n\n`;

  if (tags.length > 0) {
    md += `**Tags:** ${tags.map((t) => `\`${t}\``).join(", ")}\n\n`;
  }

  md += `---\n\n`;

  // Summary section
  md += `## Summary\n\n`;
  md += `${aiSummary || description}\n\n`;

  // Key concepts (from AI)
  if (aiKeyConcepts && aiKeyConcepts.length > 0) {
    md += `## Key Concepts\n\n`;
    aiKeyConcepts.forEach((c) => {
      md += `- ${c}\n`;
    });
    md += `\n`;
  }

  // Personal notes
  if (notes.trim()) {
    md += `## Personal Notes\n\n${notes}\n\n`;
  }

  // Code snippet
  if (code.trim()) {
    md += `## Code Example\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
  }

  // Categorized resources (matching roadmap.sh's own structure)
  if (resources.length > 0) {
    md += `## Resources\n\n`;

    // Group resources by type
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
      items.forEach((r) => {
        md += `- [${r.title}](${r.url})\n`;
      });
      md += `\n`;
    }
  }

  return md;
}
