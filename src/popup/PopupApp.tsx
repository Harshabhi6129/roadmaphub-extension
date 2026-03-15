import React, { useState, useEffect } from "react";
import { MSG } from "@/lib/constants";
import type { AuthStatus } from "@/lib/types";
import "@/styles/tailwind.css";
import type { ProgressStore } from "@/lib/progressStore";

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
    "ai-agents": "🤖", "prompt-engineering": "✨", "claude-code": "🤖",
  };
  return map[slug] || "📘";
}

function ProgressSection() {
  const [store, setStore] = useState<ProgressStore>({});

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

  if (slugs.length === 0) {
    return (
      <p className="text-xs text-gray-500 italic text-center py-2">
        Visit any roadmap.sh page and your progress will sync automatically.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {slugs.map((slug) => {
        const r = store[slug];
        return (
          <div key={slug} className="bg-gray-800/40 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-200">
                {getRoadmapEmoji(slug)} {r.displayName}
              </span>
              <span className="text-xs font-bold text-green-400">{r.progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${r.progressPercent}%`,
                  background:
                    r.progressPercent >= 75 ? "#22c55e" : r.progressPercent >= 50 ? "#eab308" : r.progressPercent >= 25 ? "#f97316" : "#ef4444",
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-500 font-medium">{r.completed} done</span>
              <span className="text-[10px] text-gray-500 font-medium">
                {Math.max(0, r.total - r.completed)} left
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PopupApp() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [syncStatus, setSyncStatus] = useState("");

  useEffect(() => {
    chrome.runtime.sendMessage({ type: MSG.GET_AUTH_STATUS }, (resp: AuthStatus) => {
      setAuthStatus(resp);
    });
  }, []);

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
          });
        } else {
          setLoginError(resp?.error || "Connection failed.");
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
      setSyncStatus("✅ Progress synced from page!");
      setTimeout(() => setSyncStatus(""), 3000);
    } else {
      setSyncStatus("⚠️ Open a roadmap.sh page to sync.");
      setTimeout(() => setSyncStatus(""), 3000);
    }
  };

  return (
    <div className="w-[380px] bg-gray-950 text-gray-100 flex flex-col shadow-2xl overflow-hidden">
      <div className="px-5 py-5 border-b border-gray-900 bg-gray-950/50 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent inline-block">
          🗺️ RoadmapHub
        </h1>
        <p className="text-xs text-gray-500 mt-1 font-medium">
          Automate your roadmap.sh progress tracking.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[500px] px-5 py-6 space-y-8 scroll-smooth hover:scrollbar-thin">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em]">
              GitHub Status
            </h2>
            {syncStatus && <span className="text-[10px] font-bold text-green-400 animate-pulse">{syncStatus}</span>}
          </div>

          {authStatus.isLoggedIn ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-gray-900/40 border border-gray-800 rounded-xl px-4 py-3 group hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-3">
                  {authStatus.avatarUrl && (
                    <div className="relative">
                      <img src={authStatus.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full ring-2 ring-gray-900 shadow-lg" />
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-gray-950 rounded-full" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">{authStatus.username}</p>
                    <p className="text-[11px] text-gray-500 font-medium">Connected to GitHub</p>
                  </div>
                </div>
                <button onClick={handleLogout} className="text-[10px] font-bold text-gray-500 hover:text-red-400 uppercase tracking-wider transition-colors">
                  Sign Out
                </button>
              </div>
              
              <button
                onClick={handleSyncProgress}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-200 font-bold py-3 text-xs uppercase tracking-wider transition-all shadow-sm active:scale-[0.98]"
              >
                📊 Sync Progress from Page
              </button>
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

        <section>
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-4">
            🚀 Your Progress
          </h2>
          <ProgressSection />
        </section>

        <section className="bg-gray-900/30 border border-gray-900 rounded-xl p-4">
          <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.1em] mb-3">
            Quick Tips
          </h2>
          <ul className="text-[11px] text-gray-500 space-y-2 font-medium">
            <li className="flex gap-2">
              <span className="text-gray-400">1.</span>
              <span>Open any topic on roadmap.sh to see the learning panel.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400">2.</span>
              <span>Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-200 text-[10px]">D</kbd> to mark a topic as done.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400">3.</span>
              <span>Sync button above re-reads your baseline progress.</span>
            </li>
          </ul>
        </section>
      </div>

      <div className="px-5 py-4 border-t border-gray-900 bg-gray-950/80 text-center">
        <p className="text-[10px] text-gray-600 font-bold tracking-wider">
          ROADMAPHUB v2.0.0 &nbsp;·&nbsp; SECURE & OFFLINE-FIRST
        </p>
      </div>
    </div>
  );
}
