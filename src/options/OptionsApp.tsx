import React, { useState, useEffect } from "react";
import { MSG } from "@/lib/constants";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { ExtensionSettings } from "@/lib/types";

const TOKEN_HELP = `Available tokens:
  {action}  → "learn" or "update"
  {roadmap} → roadmap slug (e.g. "backend")
  {topic}   → topic name (e.g. "ACID Properties")
  {date}    → today's date (YYYY-MM-DD)`;

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MSG.GET_SETTINGS }, (s: ExtensionSettings) => {
      if (s) setSettings(s);
    });
  }, []);

  const handleSave = () => {
    chrome.runtime.sendMessage(
      { type: MSG.SAVE_SETTINGS, payload: settings },
      () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    );
  };

  const handleClearData = () => {
    if (!window.confirm("This will clear all local progress data (committedSlugs, streak, etc). Your GitHub repo is not affected. Continue?")) return;
    setClearing(true);
    chrome.storage.local.remove(
      ["roadmap_progress", "roadmaphub_streak", "onboarding_dismissed", "official_topic_counts"],
      () => {
        setClearing(false);
        setCleared(true);
        setTimeout(() => setCleared(false), 3000);
      }
    );
  };

  const update = (patch: Partial<ExtensionSettings>) =>
    setSettings(prev => ({ ...prev, ...patch }));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
            🗺️ RoadmapHub Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Customize how RoadmapHub tracks and commits your learning.
          </p>
        </div>

        <div className="space-y-6">
          {/* GitHub Repo */}
          <Section title="GitHub Repository">
            <Field
              label="Repository Name"
              description="The GitHub repo where your learning notes are stored."
            >
              <input
                type="text"
                value={settings.repoName}
                onChange={e => update({ repoName: e.target.value.trim() || DEFAULT_SETTINGS.repoName })}
                className="input"
                placeholder="dev-learning-log"
              />
            </Field>
          </Section>

          {/* Commit Message */}
          <Section title="Commit Message Format">
            <Field
              label="Format Template"
              description={TOKEN_HELP}
            >
              <input
                type="text"
                value={settings.commitMessageFormat}
                onChange={e => update({ commitMessageFormat: e.target.value || DEFAULT_SETTINGS.commitMessageFormat })}
                className="input"
                placeholder="{action}({roadmap}): {topic}"
              />
            </Field>
            <div className="mt-2 px-3 py-2 bg-gray-900 rounded-lg text-xs text-gray-400 font-mono">
              Preview:{" "}
              <span className="text-green-400">
                {settings.commitMessageFormat
                  .replace("{action}", "learn")
                  .replace("{roadmap}", "backend")
                  .replace("{topic}", "ACID Properties")
                  .replace("{date}", new Date().toISOString().split("T")[0])}
              </span>
            </div>
          </Section>

          {/* AI */}
          <Section title="AI Enhancement">
            <Field
              label="Enable AI Summaries"
              description="Use Gemini AI to auto-generate summaries and key concepts when you commit a topic."
            >
              <Toggle
                value={settings.aiEnabled}
                onChange={v => update({ aiEnabled: v })}
              />
            </Field>
          </Section>

          {/* Panel Position */}
          <Section title="Floating Panel">
            <Field
              label="Panel Position"
              description="Which side of the screen the commit panel slides in from."
            >
              <div className="flex gap-3">
                {(["right", "left"] as const).map(pos => (
                  <button
                    key={pos}
                    onClick={() => update({ panelPosition: pos })}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      settings.panelPosition === pos
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    {pos === "right" ? "→ Right" : "← Left"}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          {/* Note Template */}
          <Section title="Note Template">
            <Field
              label="Default Notes Placeholder"
              description="This text appears as a placeholder in the Personal Notes field. Leave empty for the default hint."
            >
              <textarea
                value={settings.noteTemplate}
                onChange={e => update({ noteTemplate: e.target.value })}
                rows={3}
                className="input resize-y"
                placeholder="e.g. ## What I learned\n\n## Questions I still have\n\n## How I'd use this"
              />
            </Field>
          </Section>

          {/* Data Management */}
          <Section title="Data Management">
            <Field
              label="Clear Local Progress Data"
              description="Removes locally stored progress, streak, and cache. Your GitHub repo is not affected. Use 'Sync GitHub' in the popup to rebuild from your repo."
            >
              <button
                onClick={handleClearData}
                disabled={clearing}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-950/50 border border-red-900/50 text-red-400 hover:bg-red-950 hover:border-red-800 transition-all disabled:opacity-50"
              >
                {clearing ? "Clearing..." : cleared ? "✅ Cleared!" : "Clear Local Data"}
              </button>
            </Field>
          </Section>
        </div>

        {/* Save button */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold text-sm transition-all active:scale-[0.98]"
          >
            Save Settings
          </button>
          {saved && (
            <span className="text-sm text-green-400 font-medium animate-pulse">
              ✅ Saved!
            </span>
          )}
        </div>

        <p className="mt-8 text-[11px] text-gray-700 text-center font-medium">
          ROADMAPHUB v2.1.0
        </p>
      </div>

      <style>{`
        .input {
          width: 100%;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #e2e8f0;
          font-size: 13px;
          padding: 8px 12px;
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: #3b82f6; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-5 space-y-4">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.1em]">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-semibold text-gray-200">{label}</label>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        value ? "bg-green-600" : "bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
