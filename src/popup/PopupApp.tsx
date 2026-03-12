import React, { useState, useEffect } from "react";
import { MSG } from "@/lib/constants";
import type { AuthStatus } from "@/lib/types";
import "@/styles/tailwind.css";

export function PopupApp() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

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

  return (
    <div className="w-[380px] min-h-[420px] bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
          🗺️ RoadmapHub
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Turn your roadmap.sh learning into a GitHub portfolio.
        </p>
      </div>

      <div className="flex-1 px-5 py-5 space-y-6">
        {/* GitHub Auth */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            GitHub Connection
          </h2>

          {authStatus.isLoggedIn ? (
            <div className="flex items-center justify-between bg-gray-800/60 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                {authStatus.avatarUrl && (
                  <img src={authStatus.avatarUrl} alt="avatar" className="w-8 h-8 rounded-full" />
                )}
                <div>
                  <p className="text-sm font-medium text-white">{authStatus.username}</p>
                  <p className="text-xs text-green-400">✓ Connected</p>
                </div>
              </div>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-red-400 transition">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {loginError && (
                <div className="rounded-md bg-red-900/40 border border-red-700 p-3 text-xs text-red-300">
                  {loginError}
                </div>
              )}
              <button
                onClick={handleConnect}
                disabled={loginLoading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 disabled:opacity-50 text-white font-medium py-3 text-sm transition"
              >
                {loginLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Connect with GitHub
                  </>
                )}
              </button>
              <p className="text-[11px] text-gray-500 text-center">One-click OAuth — no tokens to copy.</p>
            </div>
          )}
        </section>

        {/* How It Works */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
            How It Works
          </h2>
          <ol className="text-xs text-gray-400 space-y-2 list-decimal list-inside">
            <li>Connect your GitHub above (one-click).</li>
            <li>Go to <a href="https://roadmap.sh" target="_blank" rel="noreferrer noopener" className="text-blue-400 underline">roadmap.sh</a> and open any roadmap.</li>
            <li>Click a topic → click <strong className="text-white">Done</strong> (or press <kbd className="px-1 bg-gray-800 rounded text-gray-300">D</kbd>).</li>
            <li>Edit resources, add your own links, write notes.</li>
            <li>Click <strong className="text-white">Commit</strong> — it's pushed to <code className="bg-gray-800 px-1 rounded">dev-learning-log</code>.</li>
          </ol>
          <p className="text-[11px] text-gray-500 mt-3">
            💡 Press <kbd className="px-1 bg-gray-800 rounded text-gray-300">Ctrl+Shift+D</kbd> to manually trigger on any open topic.
          </p>
        </section>
      </div>

      <div className="px-5 py-3 border-t border-gray-800 text-center">
        <p className="text-[10px] text-gray-600">RoadmapHub v0.1.0 — Like LeetHub, but for learning.</p>
      </div>
    </div>
  );
}
