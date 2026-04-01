import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "RoadmapHub",
  description: "Turn your roadmap.sh learning progress into a GitHub portfolio. LeetHub for learning roadmaps.",
  version: "2.1.0",
  icons: {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
    },
  },
  options_ui: {
    page: "src/options/index.html",
    open_in_tab: true,
  },
  permissions: ["storage", "activeTab", "scripting", "identity", "alarms", "tabs"],
  host_permissions: [
    "https://roadmap.sh/*",
    "https://api.github.com/*",
    "https://github.com/*",
    "https://*.workers.dev/*",
  ],
  background: {
    service_worker: "src/background/index.ts",
    type: "module" as const,
  },
  content_scripts: [
    {
      matches: ["https://roadmap.sh/*"],
      js: ["src/content/index.tsx"],
      css: [],
      run_at: "document_idle",
    },
  ],
});
