import React, { useState, useEffect } from "react";
import { MSG } from "@/lib/constants";
import type { AuthStatus, BulkCommitResult } from "@/lib/types";
import "@/styles/tailwind.css";
import type { ProgressStore } from "@/lib/progressStore";
import type { StreakData } from "@/lib/streakStore";

function getRoadmapEmoji(slug: string): string {
  const map: Record<string, string> = {
    backend: "⚙️", frontend: "🎨", devops: "🚀", "full-stack": "🌐",
    react: "⚛️", nodejs: "💚", "node.js": "💚", python: "🐍",
    java: "☕", docker: "🐳", kubernetes: "☸️", aws: "☁️",
    linux: "🐧", javascript: "🟨", typescript: "🔷", golang: "🐹",
    rust: "🦀", sql: "🗄️", mongodb: "🍃", "postgresql-dba": "🐘",
    redis: "🔴", "cyber-security": "🔒", "machine-learning": "🤖",
    "ai-engineer": "🧠", "system-design": "🏗️", "computer-science": "💻",
    angular: "🔴", vue: "💚", nextjs: "▲", flutter: "💙",
    android: "🤖", ios: "🍎", "swift-ui": "🍎", kotlin: "🟣",
    "spring-boot": "🌿", django: "🟩", laravel: "🔴", php: "🐘",
    graphql: "🩷", terraform: "🟪", cloudflare: "🟠",
    blockchain: "⛓️", "game-developer": "🎮", "ux-design": "🎭",
    "ai-agents": "🤖", "prompt-engineering": "✨",
  };
  return map[slug] || "📘";
}

// ========== Streak widget ==========

function StreakWidget() {
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MSG.GET_STREAK }, (data: StreakData) => {
      if (data) setStreak(data);
    });
  }, []);

  if (!streak || streak.longestStreak === 0) return null;

  return (
    <div className="flex items-center justify-between bg-gradient-to-r from-orange-950/40 to-red-950/40 border border-orange-900/50 rounded-xl px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔥</span>
        <div>
          <p className="text-sm font-bold text-orange-300 leading-tight">
            {streak.currentStreak} day streak
          </p>
          <p className="text-[10px] text-orange-500 font-medium">
            Longest: {streak.longestStreak} days
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-orange-400">{streak.commitDates.length}</p>
        <p className="text-[10px] text-orange-600">total days</p>
      </div>
    </div>
  );
}

// ========== Progress section ==========

function ProgressSection() {
  const [store, setStore] = useState<ProgressStore>({});
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulking, setBulking] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["roadmap_progress"], (r) => {
      setStore(r.roadmap_progress || {});
    });
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.roadmap_progress) {
        setStore(changes.roadmap_progress.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const slugs = Object.keys(store)
    .filter((k) => store[k].total > 0)
    .sort((a, b) => store[b].progressPercent - store[a].progressPercent);

  const handleBulkCommit = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0]?.id || !tabs[0].url?.includes("roadmap.sh")) {
      setBulkStatus("⚠️ Open a roadmap.sh roadmap page first.");
      setTimeout(() => setBulkStatus(""), 3000);
      return;
    }

    setBulking(true);
    setBulkStatus("Scanning completed topics...");

    chrome.tabs.sendMessage(
      tabs[0].id!,
      { type: "GET_COMPLETED_TOPICS" },
      (resp: { success: boolean; topics: any[] }) => {
        if (!resp?.success || !resp.topics?.length) {
          setBulkStatus("⚠️ No completed topics found on this page.");
          setBulking(false);
          setTimeout(() => setBulkStatus(""), 3000);
          return;
        }

        chrome.runtime.sendMessage(
          { type: MSG.BULK_COMMIT, payload: { topics: resp.topics } },
          (result: { success: boolean; result?: BulkCommitResult; error?: string }) => {
            setBulking(false);
            if (result?.success && result.result) {
              const r = result.result;
              if (r.committed > 0) {
                setBulkStatus(
                  `✅ Committed ${r.committed} topics${r.skipped ? `, skipped ${r.skipped} already committed` : ""}!`
                );
              } else if (r.skipped > 0) {
                setBulkStatus(`✅ All ${r.skipped} topics were already committed.`);
              } else {
                setBulkStatus("⚠️ No new topics to commit.");
              }
            } else {
              setBulkStatus(`❌ ${result?.error || "Bulk commit failed."}`);
            }
            setTimeout(() => setBulkStatus(""), 5000);
          }
        );
      }
    );
  };

  if (slugs.length === 0) {
    return (
      <p className="text-xs text-gray-500 italic text-center py-2">
        Visit any roadmap.sh page and your progress will sync automatically.
      </p>
    );
  }

  const totalCommitted = slugs.reduce((s, k) => s + (store[k].committedSlugs?.length || 0), 0);

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 px-1">
        <span>{slugs.length} roadmaps</span>
        <span>{totalCommitted} topics committed</span>
      </div>

      {slugs.map((slug) => {
        const r = store[slug];
        const roadmapUrl = `https://roadmap.sh/${slug}`;
        return (
          <div key={slug} className="bg-gray-800/40 border border-gray-800 rounded-lg p-3 group">
            <div className="flex items-center justify-between mb-1.5">
              <a
                href={roadmapUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs font-medium text-gray-200 hover:text-white transition-colors no-underline"
              >
                {getRoadmapEmoji(slug)} {r.displayName}
              </a>
              <span className="text-xs font-bold text-green-400">{r.progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${r.progressPercent}%`,
                  background:
                    r.progressPercent >= 75
                      ? "#22c55e"
                      : r.progressPercent >= 50
                      ? "#eab308"
                      : r.progressPercent >= 25
                      ? "#f97316"
                      : "#ef4444",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-500 font-medium">{r.completed} done</span>
              <span className="text-[10px] text-gray-500 font-medium">
                {Math.max(0, r.total - r.completed)} left
              </span>
            </div>
            {r.lastTopicName && (
              <p className="text-[10px] text-gray-600 mt-1 truncate">
                Last: {r.lastTopicName}
              </p>
            )}
          </div>
        );
      })}

      {/* Bulk commit */}
      <button
        onClick={handleBulkCommit}
        disabled={bulking}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-200 font-bold py-2.5 text-xs uppercase tracking-wider transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
      >
        {bulking ? "⏳ Committing..." : "⚡ Bulk Commit This Roadmap"}
      </button>
      {bulkStatus && (
        <p className="text-[11px] text-center font-medium text-gray-400 animate-pulse">
          {bulkStatus}
        </p>
      )}
    </div>
  );
}

// ========== Export button ==========

function ExportButton() {
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    setExporting(true);
    chrome.runtime.sendMessage(
      { type: MSG.EXPORT_NOTES },
      (resp: { success: boolean; markdown?: string; error?: string }) => {
        setExporting(false);
        if (resp?.success && resp.markdown) {
          const blob = new Blob([resp.markdown], { type: "text/markdown" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `roadmaphub-export-${new Date().toISOString().split("T")[0]}.md`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    );
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-200 font-bold py-3 text-xs uppercase tracking-wider transition-all shadow-sm active:scale-[0.98] disabled:opacity-50"
    >
      {exporting ? "⏳ Exporting..." : "📥 Export Notes (.md)"}
    </button>
  );
}

// ========== Onboarding banner ==========

function OnboardingBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-gradient-to-r from-green-950/50 to-blue-950/50 border border-green-900/50 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <p className="text-sm font-bold text-green-300">👋 Welcome to RoadmapHub!</p>
        <button
          onClick={onDismiss}
          className="text-gray-500 hover:text-gray-300 text-xs font-bold ml-2"
        >
          ✕
        </button>
      </div>
      <ol className="text-[11px] text-gray-400 space-y-1.5 list-none">
        <li className="flex gap-2">
          <span className="text-green-400 font-bold">1.</span>
          <span>Connect GitHub above to create your learning repo automatically.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-green-400 font-bold">2.</span>
          <span>Open any topic on roadmap.sh — a panel will slide in when you mark it done.</span>
        </li>
        <li className="flex gap-2">
          <span className="text-green-400 font-bold">3.</span>
          <span>
            Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-200">D</kbd> or{" "}
            <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-200">Ctrl+Shift+D</kbd> to
            trigger the panel manually.
          </span>
        </li>
        <li className="flex gap-2">
          <span className="text-green-400 font-bold">4.</span>
          <span>Use ⚡ Bulk Commit to catch up on topics you already finished.</span>
        </li>
      </ol>
    </div>
  );
}

// ========== Main PopupApp ==========

export function PopupApp() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [syncStatus, setSyncStatus] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MSG.GET_AUTH_STATUS }, (resp: AuthStatus) => {
      setAuthStatus(resp);
    });

    // Show onboarding only on very first load (no auth yet)
    chrome.storage.local.get(["onboarding_dismissed"], (r) => {
      if (!r.onboarding_dismissed) setShowOnboarding(true);
    });
  }, []);

  const dismissOnboarding = () => {
    setShowOnboarding(false);
    chrome.storage.local.set({ onboarding_dismissed: true });
  };

  const handleConnect = () => {
    setLoginLoading(true);
    setLoginError("");
    chrome.runtime.sendMessage(
      { type: MSG.LOGIN_GITHUB },
      (resp: { success: boolean; error?: string }) => {
        setLoginLoading(false);
        if (resp?.success) {
          chrome.runtime.sendMessage({ type: MSG.GET_AUTH_STATUS }, (status: AuthStatus) => {
            setAuthStatus(status);
            dismissOnboarding();
          });
        } else {
          setLoginError(resp?.error || "Connection failed. Please try again.");
        }
      }
    );
  };

  const handleLogout = () => {
    chrome.runtime.sendMessage({ type: MSG.LOGOUT_GITHUB }, () => {
      setAuthStatus({ isLoggedIn: false });
    });
  };

  const handleSyncProgress = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id && tabs[0].url?.includes("roadmap.sh")) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "TRIGGER_SYNC" });
      setSyncStatus("✅ Synced!");
      setTimeout(() => setSyncStatus(""), 2500);
    } else {
      setSyncStatus("⚠️ Open roadmap.sh to sync.");
      setTimeout(() => setSyncStatus(""), 2500);
    }
  };

  const handleGitHubSync = () => {
    setSyncStatus("Syncing from GitHub...");
    chrome.runtime.sendMessage(
      { type: MSG.SYNC_FROM_GITHUB },
      (resp: { success: boolean; synced?: number; error?: string }) => {
        if (resp?.success) {
          setSyncStatus(`✅ Synced ${resp.synced || 0} topics from GitHub!`);
        } else {
          setSyncStatus(`❌ ${resp?.error || "Sync failed."}`);
        }
        setTimeout(() => setSyncStatus(""), 3500);
      }
    );
  };

  const openSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-[380px] bg-gray-950 text-gray-100 flex flex-col shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-900 bg-gray-950/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent inline-block">
            🗺️ RoadmapHub
          </h1>
          <button
            onClick={openSettings}
            className="text-gray-500 hover:text-gray-300 text-sm transition-colors"
            title="Settings"
          >
            ⚙️
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-0.5 font-medium">
          Automate your roadmap.sh progress tracking.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[560px] px-5 py-5 space-y-6 scroll-smooth">
        {/* Onboarding */}
        {showOnboarding && <OnboardingBanner onDismiss={dismissOnboarding} />}

        {/* GitHub Status */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">
              GitHub Status
            </h2>
            {syncStatus && (
              <span className="text-[10px] font-bold text-green-400 animate-pulse">
                {syncStatus}
              </span>
            )}
          </div>

          {authStatus.isLoggedIn ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  {authStatus.avatarUrl && (
                    <div className="relative">
                      <img
                        src={authStatus.avatarUrl}
                        alt="avatar"
                        className="w-9 h-9 rounded-full ring-2 ring-gray-900"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-gray-950 rounded-full" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">
                      {authStatus.username}
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium">Connected to GitHub</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-[10px] font-bold text-gray-500 hover:text-red-400 uppercase tracking-wider transition-colors"
                >
                  Sign Out
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSyncProgress}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-200 font-bold py-2.5 text-[10px] uppercase tracking-wider transition-all active:scale-[0.98]"
                >
                  📊 Sync Page
                </button>
                <button
                  onClick={handleGitHubSync}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-200 font-bold py-2.5 text-[10px] uppercase tracking-wider transition-all active:scale-[0.98]"
                  title="Recover committed topics after reinstall"
                >
                  🔄 Sync GitHub
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {loginError && (
                <div className="rounded-xl bg-red-950/30 border border-red-900/50 p-3 text-[11px] text-red-400 font-medium">
                  {loginError}
                </div>
              )}
              <button
                onClick={handleConnect}
                disabled={loginLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-950 font-bold py-3.5 text-sm transition-all shadow-xl active:scale-[0.98]"
              >
                {loginLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing In...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    Connect GitHub
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* Streak */}
        {authStatus.isLoggedIn && (
          <section>
            <StreakWidget />
          </section>
        )}

        {/* Progress */}
        <section>
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-3">
            🚀 Your Progress
          </h2>
          <ProgressSection />
        </section>

        {/* Export */}
        {authStatus.isLoggedIn && (
          <section>
            <ExportButton />
          </section>
        )}

        {/* Tips */}
        <section className="bg-gray-900/30 border border-gray-900 rounded-xl p-4">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-3">
            Quick Tips
          </h2>
          <ul className="text-[11px] text-gray-500 space-y-2 font-medium">
            <li className="flex gap-2">
              <span className="text-gray-400">1.</span>
              <span>
                Press{" "}
                <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-200 text-[10px]">D</kbd>{" "}
                on any open topic to trigger the commit panel.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400">2.</span>
              <span>
                Use <strong className="text-gray-400">⚡ Bulk Commit</strong> on a roadmap page to
                catch up on topics you already completed.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400">3.</span>
              <span>
                Use <strong className="text-gray-400">🔄 Sync GitHub</strong> to recover your
                history after reinstalling the extension.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400">4.</span>
              <span>
                Click ⚙️ to open settings and customize your repo name, commit format, and more.
              </span>
            </li>
          </ul>
        </section>
      </div>

      <div className="px-5 py-3 border-t border-gray-900 bg-gray-950/80 text-center">
        <p className="text-[10px] text-gray-600 font-bold tracking-wider">
          ROADMAPHUB v2.1.0 &nbsp;·&nbsp; SECURE & OFFLINE-FIRST
        </p>
      </div>
    </div>
  );
}
