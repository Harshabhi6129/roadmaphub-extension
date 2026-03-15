import React, { useState, useEffect, useCallback } from "react";
import type { TopicMetadata, TopicResource, PracticeFile, AuthStatus } from "@/lib/types";
import { MSG } from "@/lib/constants";

interface FloatingPanelProps {
  topic: TopicMetadata;
  onClose: () => void;
}

const resourceBadgeColors: Record<string, { bg: string; color: string }> = {
  article: { bg: "#1e3a5f", color: "#93c5fd" },
  video: { bg: "#4c1d2e", color: "#f9a8d4" },
  course: { bg: "#1e3b2e", color: "#86efac" },
  official: { bg: "#3b2e1e", color: "#fcd34d" },
  book: { bg: "#2e1e3b", color: "#c4b5fd" },
  custom: { bg: "#1e293b", color: "#e2e8f0" },
};

// ========== Inline Styles ==========
const S = {
  shell: {
    position: "fixed" as const, top: 0, right: 0, width: "390px", height: "100vh",
    zIndex: 2147483647, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    background: "#0f172a", color: "#e2e8f0", borderLeft: "1px solid #334155",
    display: "flex", flexDirection: "column" as const, boxShadow: "-4px 0 24px rgba(0,0,0,0.5)",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "12px 20px", borderBottom: "1px solid #1e293b", background: "rgba(15,23,42,0.9)",
  },
  brandText: {
    fontSize: "16px", fontWeight: 700,
    background: "linear-gradient(to right, #4ade80, #3b82f6)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  closeBtn: {
    background: "none", border: "none", color: "#94a3b8", cursor: "pointer",
    padding: "4px", borderRadius: "6px", fontSize: "18px", lineHeight: 1,
  },
  header: { padding: "16px 20px", borderBottom: "1px solid #334155" },
  headerLabel: {
    fontSize: "11px", fontWeight: 500, color: "#60a5fa",
    textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "4px",
  },
  headerTitle: { fontSize: "18px", fontWeight: 700, color: "#fff", margin: 0 },
  topicLink: {
    fontSize: "11px", color: "#94a3b8", textDecoration: "none", marginTop: "4px", display: "block",
  },
  scrollBody: { flex: 1, overflowY: "auto" as const, padding: "16px 20px" },
  section: { marginBottom: "20px" },
  label: {
    display: "block", fontSize: "11px", fontWeight: 500, color: "#94a3b8",
    textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: "6px",
  },
  textarea: {
    width: "100%", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b",
    color: "#e2e8f0", fontSize: "13px", padding: "8px 12px", outline: "none",
    resize: "vertical" as const, fontFamily: "inherit",
  },
  input: {
    width: "100%", borderRadius: "8px", border: "1px solid #475569", background: "#1e293b",
    color: "#e2e8f0", fontSize: "13px", padding: "8px 12px", outline: "none", fontFamily: "inherit",
  },
  smallInput: {
    flex: 1, borderRadius: "6px", border: "1px solid #475569", background: "#1e293b",
    color: "#e2e8f0", fontSize: "12px", padding: "6px 10px", outline: "none", fontFamily: "inherit",
  },
  aiBtn: {
    marginTop: "8px", display: "inline-flex", alignItems: "center", gap: "6px",
    fontSize: "12px", color: "#c084fc", background: "none", border: "none", cursor: "pointer", padding: 0,
  },
  resourceRow: {
    display: "flex", alignItems: "flex-start", gap: "6px", marginBottom: "6px",
    padding: "4px 0",
  },
  resourceBadge: {
    fontSize: "9px", fontWeight: 600, textTransform: "uppercase" as const,
    borderRadius: "4px", padding: "2px 5px", marginTop: "2px", flexShrink: 0,
    whiteSpace: "nowrap" as const,
  },
  resourceLink: {
    fontSize: "12px", color: "#60a5fa", textDecoration: "none",
    wordBreak: "break-all" as const, lineHeight: 1.5, flex: 1,
  },
  removeBtn: {
    background: "none", border: "none", color: "#64748b", cursor: "pointer",
    fontSize: "14px", padding: "0 2px", lineHeight: 1, flexShrink: 0, marginTop: "1px",
  },
  addRow: {
    display: "flex", gap: "6px", marginTop: "8px",
  },
  addBtn: {
    background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px",
    fontSize: "12px", fontWeight: 600, padding: "6px 12px", cursor: "pointer",
    flexShrink: 0,
  },
  fileUploadLabel: {
    display: "flex", alignItems: "center", gap: "8px", cursor: "pointer",
    fontSize: "13px", color: "#94a3b8", border: "1px dashed #475569",
    borderRadius: "8px", padding: "8px 12px",
  },
  fileChip: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    fontSize: "12px", color: "#cbd5e1", background: "#1e293b",
    borderRadius: "6px", padding: "4px 8px", marginTop: "4px",
  },
  footer: { padding: "16px 20px", borderTop: "1px solid #334155" },
  commitBtn: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    gap: "8px", borderRadius: "8px", background: "#16a34a", color: "#fff",
    fontWeight: 600, fontSize: "14px", padding: "10px", border: "none", cursor: "pointer",
  },
  errorBanner: {
    borderRadius: "8px", background: "rgba(127,29,29,0.4)", border: "1px solid #991b1b",
    padding: "10px 12px", fontSize: "13px", color: "#fca5a5", marginBottom: "16px",
  },
  infoBanner: {
    borderRadius: "8px", background: "rgba(30,58,95,0.4)", border: "1px solid #1e3a5f",
    padding: "10px 12px", fontSize: "13px", color: "#93c5fd", marginBottom: "16px",
    display: "flex", gap: "8px", alignItems: "center",
  },
  successContainer: {
    display: "flex", flexDirection: "column" as const, alignItems: "center",
    justifyContent: "center", height: "100%", gap: "16px", padding: "24px",
  },
};

export function FloatingPanel({ topic, onClose }: FloatingPanelProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [isAlreadyCommitted, setIsAlreadyCommitted] = useState(false);
  const [description, setDescription] = useState(topic.description);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [resources, setResources] = useState<TopicResource[]>([...topic.resources]);
  const [newResourceUrl, setNewResourceUrl] = useState("");
  const [commitMessage, setCommitMessage] = useState(
    `learn(${topic.roadmapSlug}): ${topic.topicName}`
  );
  const [practiceFiles, setPracticeFiles] = useState<PracticeFile[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "enhancing" | "success" | "error">("idle");
  const [commitUrl, setCommitUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    
    // Check Auth
    chrome.runtime.sendMessage({ type: MSG.GET_AUTH_STATUS }, (resp: AuthStatus) => {
      if (cancelled) return;
      if (chrome.runtime.lastError) {
        setErrorMsg("Extension context lost. Refresh the page.");
        return;
      }
      setAuthStatus(resp);
    });

    // Check if Already Committed
    chrome.runtime.sendMessage(
      { 
        type: MSG.CHECK_TOPIC_EXISTS, 
        payload: { slug: topic.roadmapSlug, topicSlug: topic.topicSlug } 
      },
      (resp: { exists: boolean }) => {
        if (cancelled) return;
        if (resp?.exists) {
          setIsAlreadyCommitted(true);
          setCommitMessage(`update(${topic.roadmapSlug}): ${topic.topicName}`);
        }
      }
    );

    return () => { cancelled = true; };
  }, [topic.roadmapSlug, topic.topicSlug]);

  // Remove a resource
  const removeResource = useCallback((index: number) => {
    setResources(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Add a custom resource
  const addResource = useCallback(() => {
    const url = newResourceUrl.trim();
    if (!url) return;

    // Infer type from URL
    let type = "custom";
    if (url.includes("youtube.com") || url.includes("youtu.be")) type = "video";
    else if (url.includes("udemy.com") || url.includes("coursera.org")) type = "course";
    else if (url.includes("docs.") || url.includes("documentation")) type = "official";

    // Extract a title from the URL
    const title = url
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")
      .slice(0, 2)
      .join("/")
      .replace(/\/$/, "");

    setResources(prev => [...prev, { type, title, url }]);
    setNewResourceUrl("");
  }, [newResourceUrl]);

  // AI Enhance
  const handleAIEnhance = useCallback(async () => {
    setStatus("enhancing");
    chrome.runtime.sendMessage(
      {
        type: MSG.AI_ENHANCE,
        payload: {
          topicName: topic.topicName,
          roadmapDomain: topic.roadmapDomain,
          description,
          notes,
        },
      },
      (resp: { success: boolean; data?: { summary: string; keyConcepts: string[]; tags: string[] }; error?: string }) => {
        if (chrome.runtime.lastError) {
          setErrorMsg("Extension context lost. Refresh the page.");
          setStatus("idle");
          return;
        }
        if (resp.success && resp.data) {
          setDescription(resp.data.summary);
          if (resp.data.tags?.length) {
            const existing = tags.split(",").map(t => t.trim()).filter(Boolean);
            setTags(Array.from(new Set([...existing, ...resp.data.tags])).join(", "));
          }
          setNotes(prev =>
            prev + (prev ? "\n\n" : "") +
            "### Key Concepts\n" +
            resp.data!.keyConcepts.map(c => `- ${c}`).join("\n")
          );
        } else {
          setErrorMsg(resp.error || "AI enhancement failed");
        }
        setStatus("idle");
      }
    );
  }, [topic, description, notes, tags]);

  // File upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setPracticeFiles(prev => [...prev, { name: file.name, content: base64 }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Commit — pass the current (edited) resources back to the topic
  const handleCommit = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    const tagsArray = tags.split(",").map(t => t.trim()).filter(Boolean);
    const updatedTopic = { ...topic, resources };

    chrome.runtime.sendMessage(
      {
        type: MSG.COMMIT_LEARNING,
        payload: { topic: updatedTopic, notes, code: "", tags: tagsArray, commitMessage, practiceFiles },
      },
      (resp: { success: boolean; url?: string; error?: string }) => {
        if (chrome.runtime.lastError) {
          setErrorMsg("Extension connection lost. Please refresh the page.");
          setStatus("error");
          return;
        }
        if (resp.success) {
          setStatus("success");
          setCommitUrl(resp.url || "");
        } else {
          setStatus("error");
          setErrorMsg(resp.error || "Commit failed");
        }
      }
    );
  }, [topic, resources, notes, tags, commitMessage, practiceFiles]);

  // ===== RENDER =====

  if (!authStatus.isLoggedIn) {
    return (
      <div style={S.shell}>
        <TopBar onClose={onClose} />
        <div style={S.successContainer}>
          <span style={{ fontSize: "36px" }}>🔗</span>
          <p style={{ textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
            Connect your GitHub via the RoadmapHub extension popup first.
          </p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div style={S.shell}>
        <TopBar onClose={onClose} />
        <div style={S.successContainer}>
          <span style={{ fontSize: "48px" }}>{commitUrl ? "✅" : "⏳"}</span>
          <p style={{ fontSize: "18px", fontWeight: 600, color: "#fff" }}>
            {commitUrl ? "Committed!" : "Queued for commit"}
          </p>
          {commitUrl && (
            <a href={commitUrl} target="_blank" rel="noreferrer noopener"
               style={{ fontSize: "13px", color: "#60a5fa", textDecoration: "underline" }}>
              View on GitHub →
            </a>
          )}
          <button onClick={onClose} style={{ ...S.input, width: "auto", cursor: "pointer", textAlign: "center" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  const topicUrl = `https://roadmap.sh/${topic.roadmapSlug}`;

  return (
    <div style={S.shell}>
      <TopBar onClose={onClose} />

      {/* Header with topic link */}
      <div style={S.header}>
        <p style={S.headerLabel}>{topic.roadmapDomain}</p>
        <h2 style={S.headerTitle}>{topic.topicName}</h2>
        <a href={topicUrl} target="_blank" rel="noreferrer noopener" style={S.topicLink}>
          🔗 roadmap.sh/{topic.roadmapSlug}
        </a>
      </div>

      {/* Scrollable form */}
      <div style={S.scrollBody}>
        {errorMsg && <div style={S.errorBanner}>{errorMsg}</div>}
        
        {isAlreadyCommitted && (
          <div style={S.infoBanner}>
            <span style={{ fontSize: "16px" }}>🔄</span>
            <div>
              <strong>Already committed</strong>
              <div style={{ fontSize: "11px", opacity: 0.8 }}>This topic exists in your repo. Committing will update the existing file.</div>
            </div>
          </div>
        )}

        {/* Description */}
        <div style={S.section}>
          <label style={S.label}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
                    rows={3} style={S.textarea} />
          <button onClick={handleAIEnhance} disabled={status === "enhancing"}
                  style={{ ...S.aiBtn, opacity: status === "enhancing" ? 0.5 : 1 }}>
            {status === "enhancing" ? "⏳ Enhancing..." : "✨ Enhance with AI"}
          </button>
        </div>

        {/* Editable Resources */}
        <div style={S.section}>
          <label style={S.label}>Resources ({resources.length})</label>
          {resources.map((r, i) => (
            <div key={i} style={S.resourceRow}>
              <span style={{
                ...S.resourceBadge,
                background: resourceBadgeColors[r.type]?.bg || "#1e3a5f",
                color: resourceBadgeColors[r.type]?.color || "#93c5fd",
              }}>
                {r.type}
              </span>
              <a href={r.url} target="_blank" rel="noreferrer noopener" style={S.resourceLink}>
                {r.title}
              </a>
              <button onClick={() => removeResource(i)} style={S.removeBtn} title="Remove">✕</button>
            </div>
          ))}
          {/* Add new resource */}
          <div style={S.addRow}>
            <input
              value={newResourceUrl}
              onChange={e => setNewResourceUrl(e.target.value)}
              placeholder="Paste a URL (YouTube, docs, blog...)"
              style={S.smallInput}
              onKeyDown={e => { if (e.key === "Enter") addResource(); }}
            />
            <button onClick={addResource} style={S.addBtn}>+ Add</button>
          </div>
        </div>

        {/* Notes */}
        <div style={S.section}>
          <label style={S.label}>Personal Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    rows={3} placeholder="Add your own notes or insights..."
                    style={S.textarea} />
        </div>

        {/* Practice Files */}
        <div style={S.section}>
          <label style={S.label}>Practice Files (optional)</label>
          <label style={S.fileUploadLabel}>
            📁 Choose files...
            <input type="file" multiple onChange={handleFileUpload} style={{ display: "none" }} />
          </label>
          {practiceFiles.map((f, i) => (
            <div key={i} style={S.fileChip}>
              <span>{f.name}</span>
              <button onClick={() => setPracticeFiles(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ ...S.removeBtn, color: "#94a3b8" }}>✕</button>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div style={S.section}>
          <label style={S.label}>Tags (comma separated)</label>
          <input value={tags} onChange={e => setTags(e.target.value)}
                 placeholder="http, networking, backend" style={S.input} />
        </div>

        {/* Commit Message */}
        <div style={S.section}>
          <label style={S.label}>Commit Message</label>
          <input value={commitMessage} onChange={e => setCommitMessage(e.target.value)} style={S.input} />
        </div>
      </div>

      {/* Footer */}
      <div style={S.footer}>
        <button 
          onClick={handleCommit} 
          disabled={status === "loading"}
          style={{ 
            ...S.commitBtn, 
            background: isAlreadyCommitted ? "#2563eb" : "#16a34a",
            opacity: status === "loading" ? 0.6 : 1 
          }}
        >
          {status === "loading" ? "⏳ Committing..." : isAlreadyCommitted ? "🔄 Update on GitHub" : "🚀 Commit to GitHub"}
        </button>
      </div>
    </div>
  );
}

function TopBar({ onClose }: { onClose: () => void }) {
  return (
    <div style={S.topBar}>
      <span style={S.brandText}>RoadmapHub</span>
      <button onClick={onClose} style={S.closeBtn} title="Close">✕</button>
    </div>
  );
}
