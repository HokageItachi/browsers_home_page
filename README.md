# 🌐 Browser Home Page Hub (Multi-Browser Synchronized)

A modern, high-performance browser homepage and dashboard designed for multi-browser workflows. Any changes you make—whether updating a to-do item, typing in a sticky note, or adding a site—**synchronize in real time across any number of open browsers** (Chrome, Firefox, Microsoft Edge, Brave, etc.) via a lightweight, zero-dependency local Node.js server.

---

## ✨ Features

- **⚡ Instant Multi-Browser Real-Time Sync:**
  - Built on native Server-Sent Events (SSE) and local JSON persistence.
  - When you update a to-do, add or edit a sticky note, or click a bookmark in **Browser A**, it immediately updates in **Browser B, C, and D** without needing to reload.
  
- **🔍 Multi-Engine Search Bar:**
  - Switch between search engines on the fly: **Google**, **DuckDuckGo**, **Bing**, **YouTube**, **GitHub**, **Reddit**, **Wikipedia**, and **Brave**.
  - Shortcut search prefixes: type `!g cats` for Google, `!d privacy` for DuckDuckGo, `!y music` for YouTube, `!gh react` for GitHub, etc.
  - Smart URL detection: direct typing of URLs (e.g. `github.com` or `localhost:8080`) opens immediately.
  - Keyboard shortcut: press `Ctrl + K` or `/` from anywhere to jump straight to the search box.

- **🔥 Most Visited Sites (Speed Dial):**
  - Dynamically ranks sites by visit count (`🔥 42 visits`), or toggle to manual/pinned ordering.
  - High-resolution favicon auto-detection with fallback avatars.
  - Pin favorite sites to the top of the grid.
  - Add, edit, or remove quick links with one click.

- **✅ To-Do List:**
  - Add tasks with keyboard support (press `Enter`).
  - Interactive checkboxes with clean completed strike-through animations.
  - Filter by `All`, `Active`, and `Done`.
  - Synced instantly across all open tabs and browser windows.

- **📌 Sticky Notes:**
  - Colorful post-it note board with realistic pastel styling (Yellow, Mint, Pink, Blue, Lavender, Dark).
  - Real-time debounced auto-sync while typing.
  - Instant color switcher and quick delete.

- **🔖 Universal Bookmarks Hub & Multi-Browser Auto-Sync:**
  - Background auto-scanner for Chromium browsers (**Google Chrome**, **Microsoft Edge**, and **Brave**).
  - Preserves browser profiles and original folder breadcrumb hierarchies (e.g., `Brave • anshu66`, `Edge • Personal`).
  - **3 View Modes:** Spacious Cards Grid, Precision Multi-Column Table List, and High-Density Compact View.
  - Interactive controls: Copy link (with toast alert), open in new tab, search, sorting (Newest, Oldest, Title, Domain), quick browser filter pills, inline editing, and deletion.

- **🎨 Themes & Aesthetics:**
  - Modern glassmorphism UI with subtle ambient glow.
  - One-click Dark / Light mode toggle (synced across sessions).
  - Dynamic live clock and time-of-day greeting ("Good morning", "Good afternoon", "Good evening").
  - Live connection status indicator (`● Synced • Live`).

---

## 🚀 Quick Start

### 1. Launch the Server

Double-click `start.bat` in this folder:
```bat
start.bat
```
*Or via terminal / PowerShell:*
```bash
node server.js
```

The home page will start at:
👉 **`http://localhost:48173`**

---

## 🧭 Setting as Default Home Page in Multiple Browsers

Open each of your browsers and configure them to load `http://localhost:48173`:

### Google Chrome
1. Go to **Settings** (`chrome://settings`) &rarr; **On startup**.
2. Select **Open a specific page or set of pages** &rarr; click **Add a new page**.
3. Enter `http://localhost:48173`.
4. *(Optional for Home button)*: Go to **Appearance** &rarr; enable **Show home button** &rarr; enter `http://localhost:48173`.

### Microsoft Edge
1. Go to **Settings** (`edge://settings`) &rarr; **Start, home, and new tabs**.
2. Under *When Edge starts*, select **Open these pages** &rarr; click **Add a new page**.
3. Enter `http://localhost:48173`.

### Mozilla Firefox
1. Go to **Settings** (`about:preferences`) &rarr; **Home**.
2. Under *Homepage and new windows*, select **Custom URLs...**.
3. Enter `http://localhost:48173`.

### Brave Browser
1. Go to **Settings** (`brave://settings`) &rarr; **Get started**.
2. Under *On startup*, select **Open a specific page or set of pages** &rarr; add `http://localhost:48173`.

---

## 🔓 Auto-Launch on Windows Unlock

The server can start automatically whenever you unlock your Windows PC — no manual terminal needed.

**How it works:** A Task Scheduler task fires on workstation unlock and runs `launch.ps1`. The script checks if port `48173` is already listening — if yes, it exits silently (no duplicate terminals); if not, it opens CMD and runs `start.bat`.

### Quick Setup

1. Open Task Scheduler (`Win + R` → `taskschd.msc`).
2. Create a new task (e.g. `Run Home page`).
3. **General:** Select *Run only when user is logged on*.
4. **Trigger:** *On workstation unlock* for your user.
5. **Action:** *Start a program* →
   - **Program:** `powershell.exe`
   - **Arguments:** `-NoProfile -ExecutionPolicy Bypass -File "D:\____Drive_Files\AI_projects\browser_home_page\launch.ps1"`
   - **Start in:** `D:\____Drive_Files\AI_projects\browser_home_page`

### Test manually

```powershell
# Check if server is running:
Test-NetConnection 127.0.0.1 -Port 48173 -InformationLevel Quiet

# Run the launcher:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\____Drive_Files\AI_projects\browser_home_page\launch.ps1"
```

> 📖 Detailed setup: [docs/TASK_SCHEDULER_SETUP.md](docs/TASK_SCHEDULER_SETUP.md) · Troubleshooting: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 📁 Project Structure

```
browser_home_page/
├── data/
│   └── storage.json       # Persistent JSON storage for todos, notes, sites, settings
├── docs/
│   ├── TASK_SCHEDULER_SETUP.md  # Detailed Task Scheduler configuration
│   └── TROUBLESHOOTING.md       # Common issues and diagnostics
├── public/
│   ├── css/
│   │   └── style.css      # Clean, modern responsive stylesheet with dark/light modes
│   ├── js/
│   │   └── app.js         # Real-time SSE listener, search engine handler & state sync
│   └── index.html         # Single-page dashboard markup
├── server.js              # Zero-dependency Node.js HTTP & SSE synchronization server
├── start.bat              # 1-click Windows launcher
├── launch.ps1             # Auto-launch script (port check + dedup)
├── package.json
└── README.md
```

---

## 💡 Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + K` or `/` | Focus search bar |
| `Esc` | Clear search bar / Close open dialog modals |
| `!g <query>` | Instant search with Google |
| `!d <query>` | Instant search with DuckDuckGo |
| `!y <query>` | Instant search with YouTube |
| `!gh <query>` | Instant search with GitHub |
| `!r <query>` | Instant search with Reddit |
| `!w <query>` | Instant search with Wikipedia |
| `!b <query>` | Instant search with Brave |

---

## 🧪 Automated Test Suites

The project includes an end-to-end, zero-dependency automated test suite covering Backend, Real-Time SSE Multi-Browser Sync, Frontend Logic, and Headless Chrome E2E UI/UX:

```bash
node --test tests/*.test.js
```

- **`tests/server-api.test.js`**: 18 tests verifying all REST endpoints, CORS preflight, persistence, error handling, and static file serving.
- **`tests/realtime-sync.test.js`**: 4 tests verifying simultaneous multi-client SSE connections and instant event propagation.
- **`tests/frontend-logic.test.js`**: 14 tests for search engine routing, shortcuts, direct URL detection, XSS escaping, and sorting algorithms.
- **`tests/browser-e2e.test.js`**: 9 real headless browser tests driving Chrome via DevTools Protocol to verify live DOM rendering, UI clicks, clear button UX, theme switching, to-do interactions, viewport-locked layout, and cross-tab real-time sync.

