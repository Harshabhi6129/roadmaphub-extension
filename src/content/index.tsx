/**
 * Content Script — injected into roadmap.sh pages.
 *
 * Detection Strategy (based on real DOM inspection):
 *  - Roadmap nodes are SVG <g> elements with data-node-id, data-title, data-type
 *  - Clicking a node opens a fixed right-side panel (div.fixed.top-0.right-0)
 *  - The panel has a status dropdown button showing "pending"/"Done"/"In Progress"
 *  - Dropdown items are <div role="menuitem"> with text like "Done" + shortcut "D"
 *  - roadmap.sh also supports pressing "D" key to mark as Done
 */
import React from "react";
import { createRoot } from "react-dom/client";
import { extractTopicMetadata } from "./extractors";
import { FloatingPanel } from "./components/FloatingPanel";
import type { TopicMetadata } from "@/lib/types";

const PANEL_CONTAINER_ID = "roadmaphub-floating-panel";

let panelRoot: ReturnType<typeof createRoot> | null = null;

// ========== Panel Injection ==========

function showPanel(topic: TopicMetadata) {
  if (document.getElementById(PANEL_CONTAINER_ID)) {
    destroyPanel();
  }

  const container = document.createElement("div");
  container.id = PANEL_CONTAINER_ID;
  document.body.appendChild(container);

  panelRoot = createRoot(container);
  panelRoot.render(
    React.createElement(FloatingPanel, {
      topic,
      onClose: destroyPanel,
    })
  );
}

function destroyPanel() {
  if (panelRoot) {
    panelRoot.unmount();
    panelRoot = null;
  }
  document.getElementById(PANEL_CONTAINER_ID)?.remove();
}

// ========== Detection Logic ==========

/**
 * Trigger extraction and show panel.
 * Has a dedup guard so we don't double-trigger.
 */
let lastTriggerTime = 0;
function triggerPanel() {
  const now = Date.now();
  if (now - lastTriggerTime < 1000) return; // debounce 1s
  lastTriggerTime = now;

  // Capture metadata IMMEDIATELY while the DOM is still fresh
  const capturedMetadata = extractTopicMetadata();
  if (!capturedMetadata) {
    console.debug("[RoadmapHub] Could not extract topic metadata immediately. Falling back to delayed extraction.");
  }

  // Wait for roadmap.sh to update its own UI (status marks, etc)
  setTimeout(() => {
    const finalMetadata = capturedMetadata || extractTopicMetadata();
    if (finalMetadata) {
      console.log("[RoadmapHub] ✅ Topic detected:", finalMetadata.topicName);
      showPanel(finalMetadata);
    } else {
      console.warn("[RoadmapHub] Could not extract topic metadata. Is a topic modal open?");
    }
  }, 500);
}

/**
 * Strategy 1: Click detection on Done menu items.
 *
 * The Done option is a <div role="menuitem"> containing:
 *   <span><span class="bg-green-500"></span>Done</span>
 *   <span class="text-gray-500">D</span>
 *
 * textContent is "Done D" (includes shortcut hint).
 * We need to check if the text STARTS WITH or INCLUDES "done".
 */
function setupClickDetection() {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // Walk up to find the clickable element (menuitem, button, or the target itself)
    const menuItem = target.closest('[role="menuitem"]');
    const button = target.closest("button");
    const clickable = menuItem || button || target;

    const text = clickable.textContent?.trim().toLowerCase() || "";

    // The Done menuitem text is "Done D" (includes the keyboard shortcut)
    // Also match plain "done", "mark as done", etc.
    const isDoneAction =
      text.startsWith("done") ||       // "Done D" or "Done"
      text === "mark done" ||
      text === "mark as done" ||
      text.includes("i completed");

    // Also detect "In Progress" for potential future use
    const isProgressAction = text.startsWith("in progress");

    if (isDoneAction || isProgressAction) {
      console.log(`[RoadmapHub] Detected status change: "${text}"`);
      if (isDoneAction) {
        triggerPanel();
      }
    }
  }, true); // use capture phase to catch before roadmap.sh
}

/**
 * Strategy 2: Keyboard shortcut detection.
 *
 * roadmap.sh uses "D" key to mark a topic as Done when the modal is open.
 * We detect this keypress AND our own Ctrl+Shift+D for manual trigger.
 */
function setupKeyboardDetection() {
  document.addEventListener("keydown", (e) => {
    // Ctrl+Shift+D (or Cmd+Shift+D): Manual trigger
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "D") {
      e.preventDefault();
      console.log("[RoadmapHub] Manual trigger (Ctrl+Shift+D)");
      triggerPanel();
      return;
    }

    // "D" key alone: roadmap.sh's built-in shortcut for "Done"
    // Only if not typing in an input/textarea
    if (
      e.key === "d" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !e.shiftKey
    ) {
      const activeEl = document.activeElement;
      const isTyping =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute("contenteditable") === "true";

      if (!isTyping) {
        // Check if there's a topic modal open
        const modal = document.querySelector(
          'div.fixed.top-0.right-0 h1, div[class*="fixed"] h1'
        );
        if (modal) {
          console.log('[RoadmapHub] Detected "D" key press with modal open');
          triggerPanel();
        }
      }
    }
  });
}

/**
 * Strategy 3: MutationObserver for status visual changes.
 *
 * When a topic is marked done, roadmap.sh may update the SVG with
 * visual indicators (green checkmarks, purple circles).
 */
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check for attribute changes on the status button
      if (
        mutation.type === "attributes" &&
        mutation.target instanceof HTMLElement
      ) {
        const el = mutation.target;
        if (
          el.tagName === "BUTTON" &&
          el.textContent?.trim().toLowerCase().startsWith("done")
        ) {
          console.log("[RoadmapHub] Status button changed to Done");
          triggerPanel();
        }
      }
    }
  });

  // Observe with a slight delay to let the page render
  setTimeout(() => {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-state"],
    });
  }, 2000);
}

// ========== Initialization ==========

function init() {
  if (!window.location.hostname.includes("roadmap.sh")) return;

  console.log("[RoadmapHub] 🚀 Content script loaded on", window.location.href);
  console.log("[RoadmapHub] Detection: Click • D-key • Ctrl+Shift+D");

  setupClickDetection();
  setupKeyboardDetection();
  setupMutationObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
