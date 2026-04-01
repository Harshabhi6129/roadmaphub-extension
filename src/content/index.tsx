/**
 * Content Script — injected into roadmap.sh pages.
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { extractTopicMetadata, extractAllCompletedTopics } from "./extractors";
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

// ========== Progress sync ==========

function syncPageProgress() {
  const slug = window.location.pathname.split("/").filter(Boolean)[0];
  if (!slug || slug.length < 2) return;

  const bodyText = document.body.innerText || "";
  const match = bodyText.match(/(\d+)\s+of\s+(\d+)\s+Done/i);
  if (!match) return;

  const completed = parseInt(match[1], 10);
  const total = parseInt(match[2], 10);
  if (isNaN(completed) || isNaN(total) || total <= 0) return;

  chrome.runtime.sendMessage({
    type: MSG.SYNC_PROGRESS,
    payload: { slug, completed, total, displayName: formatDomainName(slug) },
  });

  // Check if topic count changed (changelog detection)
  chrome.runtime.sendMessage({
    type: MSG.CHECK_ROADMAP_UPDATES,
    payload: { slug, currentCount: total },
  }, (result) => {
    if (result?.hasNewTopics && result.newTopicsCount > 0) {
      console.log(
        `[RoadmapHub] 🆕 ${result.newTopicsCount} new topic(s) added to the ${formatDomainName(slug)} roadmap!`
      );
      // Badge the extension icon
      chrome.runtime.sendMessage({
        type: "SET_BADGE",
        payload: { text: `+${result.newTopicsCount}`, slug },
      });
    }
  });
}

// ========== Message listener ==========

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "TRIGGER_SYNC") {
    syncPageProgress();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "GET_COMPLETED_TOPICS") {
    // Content script extracts all completed topics for bulk commit
    const topics = extractAllCompletedTopics();
    sendResponse({ success: true, topics });
    return true;
  }
});

// ========== Shadow DOM panel ==========

function showPanel(topic: TopicMetadata) {
  if (document.getElementById(PANEL_CONTAINER_ID)) {
    destroyPanel();
  }

  // FIX: Persist pending topic to session storage BEFORE rendering the panel.
  // This eliminates the race condition where navigation between session.set
  // and render completion could lose the topic state.
  chrome.storage.session.set({ pending_topic: topic }).then(() => {
    const container = document.createElement("div");
    container.id = PANEL_CONTAINER_ID;
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `:host { all: initial; font-family: sans-serif; } #mount { position: fixed; z-index: 999999; }`;
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
  });
}

function destroyPanel() {
  if (panelRoot) {
    panelRoot.unmount();
    panelRoot = null;
  }
  document.getElementById(PANEL_CONTAINER_ID)?.remove();
}

// ========== Detection logic ==========

let lastTriggerTime = 0;
function triggerPanel() {
  const now = Date.now();
  if (now - lastTriggerTime < 1000) return; // debounce 1s
  lastTriggerTime = now;

  const finalMetadata = pendingTopicMetadata || extractTopicMetadata();
  pendingTopicMetadata = null;

  if (finalMetadata) {
    showPanel(finalMetadata);
  } else {
    console.warn("[RoadmapHub] Could not extract topic metadata. Is a topic modal open?");
  }
}

function setupClickDetection() {
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as HTMLElement;
      const menuItem = target.closest('[role="menuitem"]');
      const button = target.closest("button");
      const clickable = menuItem || button || target;
      const text = clickable.textContent?.trim().toLowerCase() || "";

      const isDoneAction =
        text.startsWith("done") ||
        text === "mark done" ||
        text === "mark as done" ||
        text.includes("i completed") ||
        text.includes("mark completed") ||
        text.includes("finish") ||
        text.includes("done!");

      if (isDoneAction) {
        pendingTopicMetadata = extractTopicMetadata();
        triggerPanel();
      }
    },
    true
  );
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
        const modal = document.querySelector(
          '[data-testid="topic-detail"], [data-testid="resource-modal"], div.fixed.top-0.right-0'
        );
        if (modal) {
          pendingTopicMetadata = extractTopicMetadata();
          triggerPanel();
        }
      }
    }
  });
}

// ========== Navigation management ==========

function setupNavigationSync() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    window.dispatchEvent(new Event("roadmaphub:navigate"));
  };
  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event("roadmaphub:navigate"));
  };
  window.addEventListener("popstate", () => {
    window.dispatchEvent(new Event("roadmaphub:navigate"));
  });

  window.addEventListener("roadmaphub:navigate", () => {
    lastTriggerTime = 0;
    pendingTopicMetadata = null;
    destroyPanel();
    setTimeout(syncPageProgress, 1000);

    // Restore panel if navigating back to the same roadmap with a pending topic
    chrome.storage.session.get(["pending_topic"]).then((res) => {
      if (res.pending_topic) {
        const topic = res.pending_topic as TopicMetadata;
        if (window.location.pathname.includes(topic.roadmapSlug)) {
          showPanel(topic);
        }
      }
    });
  });
}

// ========== Init ==========

function init() {
  if (!window.location.hostname.includes("roadmap.sh")) return;
  console.log("[RoadmapHub] Content script initialized 🚀");
  setupNavigationSync();
  setupClickDetection();
  setupKeyboardDetection();
  setTimeout(syncPageProgress, 2000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
