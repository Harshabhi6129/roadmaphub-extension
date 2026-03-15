/**
 * Content Script — injected into roadmap.sh pages.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { extractTopicMetadata } from "./extractors";
import { FloatingPanel } from "./components/FloatingPanel";
import type { TopicMetadata } from "@/lib/types";

import { MSG } from "@/lib/constants";

const PANEL_CONTAINER_ID = "roadmaphub-floating-panel";

let panelRoot: ReturnType<typeof createRoot> | null = null;
let pendingTopicMetadata: TopicMetadata | null = null;

function formatDomainName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** 
 * Scrape current roadmap progress from the page 
 * and sync to background store.
 */
function syncPageProgress() {
  const slug = window.location.pathname.split("/").filter(Boolean)[0];
  if (!slug || slug.length < 2) return;

  const bodyText = document.body.innerText || "";
  const match = bodyText.match(/(\d+)\s+of\s+(\d+)\s+Done/i);
  if (!match) return;

  const completed = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  if (isNaN(completed) || isNaN(total) || total === 0) return;

  chrome.runtime.sendMessage({
    type: MSG.SYNC_PROGRESS,
    payload: {
      slug,
      completed,
      total,
      displayName: formatDomainName(slug),
      pageUrl: window.location.href,
    },
  });
}

// ========== Message Listener for Background/Popup ==========

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "TRIGGER_SYNC") {
    console.log("[RoadmapHub] Manual progress sync triggered.");
    syncPageProgress();
  }
});


// ========== Panel Injection with Shadow DOM ==========

function showPanel(topic: TopicMetadata) {
  if (document.getElementById(PANEL_CONTAINER_ID)) {
    destroyPanel();
  }

  const container = document.createElement("div");
  container.id = PANEL_CONTAINER_ID;
  document.body.appendChild(container);

  // Attach Shadow DOM for isolation
  const shadow = container.attachShadow({ mode: "open" });
  
  // Inject internal styles
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; font-family: sans-serif; }
    #mount { position: fixed; z-index: 999999; }
  `;
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  mountPoint.id = "mount";
  shadow.appendChild(mountPoint);

  panelRoot = createRoot(mountPoint);
  panelRoot.render(
    React.createElement(FloatingPanel, {
      topic,
      onClose: () => {
        destroyPanel();
        chrome.storage.session.remove(["pending_topic"]);
      },
    })
  );

  // Persist to session storage for navigation recovery
  chrome.storage.session.set({ pending_topic: topic });
}

function destroyPanel() {
  if (panelRoot) {
    panelRoot.unmount();
    panelRoot = null;
  }
  document.getElementById(PANEL_CONTAINER_ID)?.remove();
}

// ========== Detection Logic ==========

let lastTriggerTime = 0;
function triggerPanel() {
  const now = Date.now();
  if (now - lastTriggerTime < 1000) return; // debounce 1s
  lastTriggerTime = now;

  // Use pre-captured metadata if available, else try extracting now
  const finalMetadata = pendingTopicMetadata || extractTopicMetadata();
  pendingTopicMetadata = null; // reset

  if (finalMetadata) {
    console.log("[RoadmapHub] ✅ Topic detected:", finalMetadata.topicName);
    // 500ms delay for visual smoothness
    setTimeout(() => showPanel(finalMetadata), 500);
  } else {
    console.warn("[RoadmapHub] Could not extract topic metadata. Is a topic modal open?");
  }
}

function setupClickDetection() {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const menuItem = target.closest('[role="menuitem"]');
    const button = target.closest("button");
    const clickable = menuItem || button || target;

    const text = clickable.textContent?.trim().toLowerCase() || "";
    const isDoneAction =
      text.startsWith("done") ||
      text === "mark done" ||
      text === "mark as done" ||
      text.includes("i completed");

    if (isDoneAction) {
      console.log(`[RoadmapHub] Detected click: "${text}"`);
      pendingTopicMetadata = extractTopicMetadata();
      triggerPanel();
    }
  }, true);
}

function setupKeyboardDetection() {
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
      e.preventDefault();
      triggerPanel();
      return;
    }

    if (e.key === "d" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute("contenteditable") === "true";

      if (!isTyping) {
        const modal = document.querySelector('[data-testid="topic-detail"], [data-testid="resource-modal"], div.fixed.top-0.right-0');
        if (modal) {
          pendingTopicMetadata = extractTopicMetadata();
          triggerPanel();
        }
      }
    }
  });
}


// ========== Navigation Management ==========

function setupNavigationSync() {
  // Monkey-patch history to detect SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    window.dispatchEvent(new Event("roadmaphub:navigate"));
  };
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event("roadmaphub:navigate"));
  };

  window.addEventListener("popstate", () => {
    window.dispatchEvent(new Event("roadmaphub:navigate"));
  });

  window.addEventListener("roadmaphub:navigate", () => {
    console.log("[RoadmapHub] 🧭 Navigation detected. Resetting state...");
    lastTriggerTime = 0;
    pendingTopicMetadata = null;
    destroyPanel();
    
    // Attempt to sync progress from the new page
    setTimeout(syncPageProgress, 1000);

    // Try to restore panel if navigating back to a topic (e.g. browser back)
    chrome.storage.session.get(["pending_topic"]).then((res) => {
      if (res.pending_topic) {
        const topic = res.pending_topic as TopicMetadata;
        // Check if the current URL matches the topic slug to avoid showing on wrong roadmap
        if (window.location.pathname.includes(topic.roadmapSlug)) {
          showPanel(topic);
        }
      }
    });
  });
}

function init() {
  if (!window.location.hostname.includes("roadmap.sh")) return;
  console.log("[RoadmapHub] Content script initialized 🚀");
  setupNavigationSync();
  setupClickDetection();
  setupKeyboardDetection();

  // Initial sync attempt
  setTimeout(syncPageProgress, 2000);

  // Re-sync on messages (existing listener is fine, but new init might override)
  // The existing listener is outside init, so it will still be active.
  // No need to re-add it here unless it's meant to be part of init.
  // For now, I'll assume the existing one is sufficient.
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
