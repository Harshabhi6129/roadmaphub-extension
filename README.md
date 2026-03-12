<div align="center">

# 🗺️ RoadmapHub

**Like [LeetHub](https://github.com/QasimWani/LeetHub), but for learning.**

A Chrome extension that turns your [roadmap.sh](https://roadmap.sh) learning progress into a structured GitHub portfolio — automatically.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/)
[![roadmap.sh](https://img.shields.io/badge/roadmap.sh-Integration-0ea5e9)](https://roadmap.sh)
[![GitHub OAuth](https://img.shields.io/badge/GitHub-OAuth-181717?logo=github)](https://docs.github.com/en/apps/oauth-apps)
[![Gemini AI](https://img.shields.io/badge/Gemini_2.5-AI_Enhanced-8E75B2?logo=googlegemini)](https://ai.google.dev/)

</div>

---

## 🎯 What It Does

You're learning Backend Development on [roadmap.sh/backend](https://roadmap.sh/backend). You click a topic, read the resources, mark it as **Done** — and RoadmapHub automatically creates a structured commit in your GitHub repo:

```
dev-learning-log/
├── README.md                  ← Auto-updated index grouped by domain
├── backend/
│   ├── internet.md            ← learn(backend): Internet
│   ├── dns.md                 ← learn(backend): DNS
│   ├── acid.md                ← learn(backend): ACID
│   └── acid-practice/         ← Uploaded practice files
├── frontend/
│   └── html.md
└── devops/
    └── docker.md
```

Each markdown file contains:
- 📝 Topic description & AI-enhanced summary
- 🔗 Curated resources (articles, videos, docs) — editable before commit
- 📓 Your personal notes
- 🏷️ Auto-generated tags
- 📅 Timestamp & source link

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **One-Click GitHub Auth** | OAuth flow — no tokens to copy, just click "Connect with GitHub" |
| **Auto-Detection** | Detects when you mark topics as Done on roadmap.sh |
| **Editable Resources** | Pre-populated from roadmap.sh — remove ones you didn't use, add your own YouTube/blog/doc links |
| **AI Enhancement** | Gemini 2.5 Flash generates summaries, key concepts, and tags |
| **Structured Commits** | `learn(backend): ACID` — organized by roadmap domain |
| **Practice File Upload** | Attach code files or notes to any topic |
| **Keyboard Shortcuts** | `D` key (native) or `Ctrl+Shift+D` to trigger manually |

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Harshabhi6129/roadmaphub-extension.git
cd roadmaphub-extension
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
VITE_GITHUB_CLIENT_ID=your_github_oauth_client_id
VITE_GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
VITE_GEMINI_API_KEY=your_gemini_api_key
```

<details>
<summary><strong>How to get these credentials</strong></summary>

**GitHub OAuth App:**
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. Set **Authorization callback URL** to: `https://<extension-id>.chromiumapp.org/`
3. Copy the Client ID and Client Secret

**Gemini API Key:**
1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Create a new key

</details>

### 3. Build & Load

```bash
npm run build
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `dist/` folder
4. Pin the extension 📌

### 4. Connect & Learn

1. Click the RoadmapHub icon → **Connect with GitHub**
2. Go to [roadmap.sh](https://roadmap.sh) → pick any roadmap
3. Click a topic → mark as **Done**
4. Edit resources, add notes → **Commit to GitHub** 🚀

---

## 🏗️ Architecture

```
src/
├── manifest.ts                 # Chrome Extension Manifest V3
├── background/
│   ├── index.ts                # Service worker: OAuth, message routing
│   ├── github.ts               # GitHub API: repo creation, commits, README
│   └── ai.ts                   # Gemini API: summaries, concepts, tags
├── content/
│   ├── index.tsx               # Content script: Done detection, panel injection
│   ├── extractors.ts           # DOM parser: extracts topic metadata from roadmap.sh
│   └── components/
│       └── FloatingPanel.tsx   # Slide-in panel UI (inline styles, no CSS deps)
├── popup/
│   ├── PopupApp.tsx            # Extension popup: GitHub connect, how-it-works
│   └── main.tsx                # React entry point
└── lib/
    ├── constants.ts            # Config: env vars, message types
    ├── types.ts                # TypeScript interfaces
    └── utils.ts                # Helpers
```

### Detection Strategies

The content script uses three strategies to detect when you complete a topic:

1. **Click Detection** — Listens for clicks on `[role="menuitem"]` elements containing "Done"
2. **Keyboard Shortcut** — Captures the `D` key press (roadmap.sh's native shortcut)
3. **Manual Trigger** — `Ctrl+Shift+D` / `Cmd+Shift+D` to trigger on any open topic

---

## 🛠️ Tech Stack

- **Extension**: Chrome Manifest V3, TypeScript
- **UI**: React 19, Inline Styles (for CSS isolation in content scripts)
- **Build**: Vite + [CRXJS](https://crxjs.dev/vite-plugin/)
- **Auth**: GitHub OAuth via `chrome.identity.launchWebAuthFlow()`
- **AI**: Google Gemini 2.5 Flash
- **Styling**: Tailwind CSS v4 (popup only)

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT © [Harsha Abhinav Kusampudi](https://github.com/Harshabhi6129)

---

<div align="center">
<sub>Built with ❤️ for developers who never stop learning.</sub>
</div>
