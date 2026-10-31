# 🌐 Browser Home Page Hub & Bookmarks Library

> **A modern, high-performance local dashboard and universal bookmarks hub designed for multi-browser workflows.**
> Built with pure Node.js (zero npm dependencies) and native Server-Sent Events (SSE). Everything you do—updating tasks, editing notes, visiting sites, or managing bookmarks—**synchronizes in real time across any number of open browsers and tabs** (Chrome, Edge, Brave, Firefox).

---

## 📑 Table of Contents

- [✨ Core Features](#-core-features)
  - [⚡ Instant Multi-Browser Real-Time Sync](#-instant-multi-browser-real-time-sync)
  - [🔖 Universal Bookmarks Hub & Auto-Import Scanner](#-universal-bookmarks-hub--auto-import-scanner)
  - [🔍 Multi-Engine Search Bar](#-multi-engine-search-bar)
  - [🔥 Most Visited Sites (Speed Dial)](#-most-visited-sites-speed-dial)
  - [✅ Interactive To-Do List](#-interactive-to-do-list)
  - [📌 Sticky Notes Board](#-sticky-notes-board)
  - [🎨 Professional Aesthetics (Zero Neon)](#-professional-aesthetics-zero-neon)
- [🏗️ Architecture & How It Works](#️-architecture--how-it-works)
- [📁 Project Directory Structure](#-project-directory-structure)
- [🚀 Quick Start Guide](#-quick-start-guide)
- [🧭 Multi-Browser Homepage Setup](#-multi-browser-homepage-setup)
- [🔓 Windows Auto-Launch on PC Unlock](#-windows-auto-launch-on-pc-unlock)
- [🔌 REST API & SSE Endpoints Reference](#-rest-api--sse-endpoints-reference)
- [🔒 Data Privacy & Storage Architecture](#-data-privacy--storage-architecture)
- [⌨️ Keyboard Shortcuts](#️-keyboard-shortcuts)
- [🧪 Automated Test Suite](#-automated-test-suite)

---

## ✨ Core Features

### ⚡ Instant Multi-Browser Real-Time Sync
* **Native Server-Sent Events (SSE):** No heavy WebSockets or socket libraries. Browsers maintain a single lightweight HTTP stream (`/api/events`).
* **Zero-Reload Experience:** Add a task in **Google Chrome**, edit a sticky note in **Brave**, or delete a bookmark in **Microsoft Edge**—every open tab and window reflects changes instantly.
* **Smart Concurrency & Focus Preservation:** Sticky notes and inputs preserve active typing focus even when concurrent background sync events arrive from another window.

---

### 🔖 Universal Bookmarks Hub & Auto-Import Scanner
A dedicated, full-featured bookmarks manager (`/bookmarks.html`) accessible via the 🔖 **Bookmarks** button in the top header.

* **Automatic Background Scanning:** The server periodically scans local bookmark files from **Google Chrome**, **Microsoft Edge**, and **Brave Browser** every 30 seconds.
* **Browser & Profile Separation:** Bookmarks are categorized by browser and human-readable profile names detected from `Local State` (e.g. `Brave — anshu66`, `Edge — Personal`, `Chrome — Work`).
* **One-Way Import Guarantee:** New bookmarks added in any browser are auto-imported. Deleting or editing a bookmark in this dashboard is local and **never modifies or deletes your actual browser bookmark files**.
* **3 Dedicated View Modes:**
  * 🔲 **Spacious Cards Grid (`view-grid`):** Generous, elongated card layout (~350px–480px width) with 2-line title clamps, 42px squircle favicons, direct domain links, browser source badges, and breadcrumb tags.
  * 📑 **Multi-Column Detailed List (`view-list`):** Precision table format with sticky column headers (`Bookmark & Domain`, `Browser / Profile`, `Folder Path`, `Added Date`, `Actions`) perfectly aligned via CSS Grid.
  * 📄 **Razor-Sharp Compact View (`view-compact`):** High-density 38px single-line data rows for lightning-fast scanning through 300+ items.
* **Quick Filter Chips:** Instant one-click browser pills (`All`, `Brave`, `Chrome`, `Edge`) in the header for fast cross-browser filtering.
* **Instant Sorting:** Sort on the fly by *Newest First*, *Oldest First*, *Title (A → Z / Z → A)*, or *Domain / Site*.
* **Micro-Actions on Every Item:**
  * 📋 **Copy Link:** Copies clean URL to clipboard with floating feedback toast notification (`Link copied to clipboard ✓`).
  * ↗ **Open Link:** Opens URL in a new tab.
  * ✏️ **Edit:** Modify title, URL, or custom collection.
  * 🗑️ **Delete:** Remove bookmark from your local library with confirmation.

---

### 🔍 Multi-Engine Search Bar
* **Switch Engines Instantly:** **Google**, **DuckDuckGo**, **Bing**, **YouTube**, **GitHub**, **Reddit**, **Wikipedia**, and **Brave**.
* **Quick Chip Shortcuts:** Clickable engine chips under the search input execute your current query immediately.
* **Bang Shortcuts:** Type `!g <query>` for Google, `!d <query>` for DuckDuckGo, `!y <query>` for YouTube, `!gh <query>` for GitHub, `!r <query>` for Reddit, `!w <query>` for Wikipedia, etc.
* **Smart URL Auto-Detection:** Direct URLs (e.g. `github.com`, `localhost:3000`) open directly without performing a web search.
* **Hotkey Focus:** Press `Ctrl + K` or `/` from anywhere on the page to focus the search box.

---

### 🔥 Most Visited Sites (Speed Dial)
* **Visit Counter Auto-Rank:** Automatically increments visit counts on click (`🔥 43 visits`) and dynamically promotes your most frequented destinations.
* **Manual & Pinned Reordering:** Pin vital shortcuts to the front of the grid or toggle between *Sort by Visits* and *Manual Order*.
* **Favicon Discovery:** Uses high-resolution Google Favicon resolution with clean, monogram fallback avatars.

---

### ✅ Interactive To-Do List
* **Quick Task Entry:** Type and press `Enter` to add tasks instantly.
* **Inline Editing:** Double-click any task label to edit text inline without opening a modal.
* **Status Filtering:** Fast filter tabs for `All`, `Active`, and `Done` with dynamic pending count badges.

---

### 📌 Sticky Notes Board
* **6 Color Palettes:** Realistic pastel colors (*Yellow*, *Mint*, *Pink*, *Blue*, *Lavender*, and *Dark Slate*).
* **Debounced Auto-Save:** Automatically saves content 400ms after you stop typing.
* **Multi-Client Reconciliation:** Seamless editing across devices without cursor jumps.

---

### 🎨 Professional Aesthetics (Zero Neon)
* **Strictly No Neon Glows:** Designed with a refined, modern SaaS aesthetic inspired by Linear, Raycast, and Arc.
* **Dark & Light Mode:** Seamless toggle synced across all sessions, using CSS custom properties with smooth transitions.
* **Dynamic Time Greeting:** Live clock with contextual greetings (*"Good morning"*, *"Good afternoon"*, *"Good evening"*).

---

## 🏗️ Architecture & How It Works

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Client Browsers / Tabs                         │
│  [ Chrome Tab ]       [ Brave Tab ]       [ Edge Tab ]   [ Firefox ]  │
└───────┬────────────────────┬────────────────────┬──────────────┬──────┘
        │                    │                    │              │
        │ HTTP REST (CRUD)   │                    │              │
        ▼                    ▼                    ▼              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Local Node.js Server (Port 48173)                     │
│                                                                        │
│  ├── Static File Server (HTML, CSS, JS)                                │
│  ├── REST API Dispatcher (/api/todos, /api/notes, /api/bookmarks)       │
│  └── SSE Broadcaster (Pushes state changes to all connected tabs)      │
└──────────────────────────┬──────────────────────┬──────────────────────┘
                           │                      │
       Reads / Writes State│                      │ Reads Bookmark JSONs
                           ▼                      ▼
               ┌──────────────────────┐  ┌──────────────────────────────┐
               │  data/storage.json   │  │   Chromium User Data Dirs    │
               │ (Persistent Database)│  │ (Chrome, Brave, Edge Profile │
               └──────────────────────┘  │  Bookmarks & Local State)    │
                                         └──────────────────────────────┘
```

1. **`server.js`** starts a zero-dependency HTTP server on port `48173`.
2. When any browser connects, it establishes an **EventSource** connection to `/api/events`.
3. Every mutation (adding a todo, editing a note, adding/deleting a bookmark) writes to `data/storage.json` and broadcasts an SSE event to all connected browsers.
4. **`bookmark-scanner.js`** runs in the background every 30 seconds:
   - Reads `Local State` in Chrome, Edge, and Brave to discover user profiles.
   - Reads `Bookmarks` JSON files in each profile directory.
   - Recursively extracts URL nodes and deduplicates them using a unique `sourceKey` (`Browser|Profile|URL`).
   - Inserts newly discovered bookmarks into `data/storage.json` and notifies the UI via SSE.

---

## 📁 Project Directory Structure

```
browser_home_page/
├── .gitignore                    # Protects logs, node_modules, and sensitive data
├── bookmark-scanner.js           # Chromium browser bookmark auto-scanner & deduplicator
├── launch.ps1                    # Background unlock launcher (port checking & dedup)
├── package.json                  # Project metadata and test runner scripts
├── README.md                     # Comprehensive documentation
├── server.js                     # Zero-dependency Node.js HTTP & SSE sync server
├── start.bat                     # 1-click Windows batch launcher
├── data/
│   └── storage.json              # Persistent database (todos, notes, sites, bookmarks, settings)
├── docs/
│   ├── TASK_SCHEDULER_SETUP.md   # Windows Task Scheduler step-by-step configuration
│   └── TROUBLESHOOTING.md        # Network & port exclusion troubleshooting guide
├── public/
│   ├── index.html                # Main dashboard page
│   ├── bookmarks.html            # Standalone Universal Bookmarks Hub
│   ├── css/
│   │   ├── style.css             # Dashboard stylesheet & theme definitions
│   │   └── bookmarks.css         # Bookmarks hub styles (Grid, Table List, Compact)
│   └── js/
│       ├── app.js                # Dashboard client logic & SSE listeners
│       └── bookmarks.js          # Bookmarks client logic, rendering & event controllers
└── tests/
    ├── browser-e2e.test.js       # Headless Chrome DevTools Protocol UI/UX tests
    ├── frontend-logic.test.js    # Unit tests for search routing, URLs, and XSS escaping
    ├── realtime-sync.test.js     # Real-time multi-client SSE synchronization tests
    └── server-api.test.js        # REST API endpoint and persistence tests
```

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** (v18.0.0 or higher recommended)

### 1. Start the Server
Double-click `start.bat` or run in terminal:
```bash
node server.js
```

### 2. Access the Application
Open your browser and navigate to:
* **Dashboard:** [http://localhost:48173](http://localhost:48173)
* **Bookmarks Hub:** [http://localhost:48173/bookmarks.html](http://localhost:48173/bookmarks.html)

---

## 🧭 Multi-Browser Homepage Setup

Set `http://localhost:48173` as your default startup page and new tab in all your browsers:

### Google Chrome
1. Navigate to `chrome://settings/onStartup`.
2. Select **Open a specific page or set of pages** &rarr; click **Add a new page**.
3. Enter `http://localhost:48173`.
4. *(Optional Home button)*: Open `chrome://settings/appearance` &rarr; enable **Show home button** &rarr; enter `http://localhost:48173`.

### Microsoft Edge
1. Navigate to `edge://settings/startHomeNNewTabs`.
2. Under *When Edge starts*, select **Open these pages** &rarr; click **Add a new page**.
3. Enter `http://localhost:48173`.

### Brave Browser
1. Navigate to `brave://settings/getStarted`.
2. Under *On startup*, select **Open a specific page or set of pages** &rarr; add `http://localhost:48173`.

### Mozilla Firefox
1. Navigate to `about:preferences#home`.
2. Under *Homepage and new windows*, select **Custom URLs...** &rarr; enter `http://localhost:48173`.

---

## 🔓 Windows Auto-Launch on PC Unlock

The server can start automatically in the background whenever you unlock your Windows workstation—ensuring your homepage is always running.

The `launch.ps1` script checks whether port `48173` is already listening:
* If running: exits silently (no duplicate processes or intrusive console popups).
* If stopped: launches `start.bat` cleanly.

### Task Scheduler Setup
1. Press `Win + R` &rarr; type `taskschd.msc` &rarr; press Enter.
2. Click **Create Task...**
   * **Name:** `Launch Browser Home Page Hub`
   * **Security Options:** Select *Run only when user is logged on*.
3. **Triggers Tab:** Click *New...* &rarr; select **On workstation unlock** for your user account.
4. **Actions Tab:** Click *New...* &rarr; select **Start a program**:
   * **Program/script:** `powershell.exe`
   * **Arguments:** `-NoProfile -ExecutionPolicy Bypass -File "D:\____Drive_Files\AI_projects\browser_home_page\launch.ps1"`
   * **Start in:** `D:\____Drive_Files\AI_projects\browser_home_page`

> For advanced Task Scheduler configurations and diagnostics, see [docs/TASK_SCHEDULER_SETUP.md](docs/TASK_SCHEDULER_SETUP.md).

---

## 🔌 REST API & SSE Endpoints Reference

All endpoints accept and return JSON with standard CORS support.

| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/events` | Server-Sent Events (SSE) real-time stream | *None (text/event-stream)* |
| `GET` | `/api/state` | Retrieves complete snapshot of settings, sites, todos, notes, bookmarks | *None* |
| `PUT` | `/api/settings` | Updates application settings (theme, active search engine, sorting) | `{"theme": "dark", "activeSearchEngine": "google"}` |
| `POST` | `/api/sites` | Creates a new speed dial link | `{"title": "GitHub", "url": "https://github.com", "pinned": false}` |
| `POST` | `/api/sites/:id/visit` | Increments visit counter for site | *None* |
| `PUT` | `/api/sites/:id` | Updates site title, URL, or pinned status | `{"title": "GitHub", "url": "https://github.com"}` |
| `DELETE`| `/api/sites/:id` | Deletes site link | *None* |
| `POST` | `/api/todos` | Adds a new task | `{"text": "Review pull request"}` |
| `PUT` | `/api/todos/:id` | Updates task text or toggles completion | `{"completed": true}` |
| `DELETE`| `/api/todos/:id` | Deletes task | *None* |
| `POST` | `/api/notes` | Creates a new sticky note | `{"title": "Ideas", "content": "Hello", "color": "yellow"}` |
| `PUT` | `/api/notes/:id` | Updates sticky note content, title, or color | `{"content": "Updated draft"}` |
| `DELETE`| `/api/notes/:id` | Deletes sticky note | *None* |
| `GET` | `/api/bookmarks` | Returns all imported and custom bookmarks | *None* |
| `POST` | `/api/bookmarks` | Manually creates a new bookmark | `{"title": "React Docs", "url": "https://react.dev", "group": "Docs"}` |
| `PUT` | `/api/bookmarks/:id`| Updates bookmark title, URL, or collection | `{"title": "New Title", "group": "Dev"}` |
| `DELETE`| `/api/bookmarks/:id`| Deletes a bookmark | *None* |
| `PUT` | `/api/bookmarks/groups/rename` | Renames a collection across all bookmarks | `{"oldName": "Docs", "newName": "Documentation"}` |
| `DELETE`| `/api/bookmarks/groups/:group` | Deletes all bookmarks inside a collection | *None* |

---

## 🔒 Data Privacy & Storage Architecture

### How Local Storage Works
All application state is saved locally in `data/storage.json`.

```json
{
  "settings": {
    "theme": "dark",
    "userName": "Explorer",
    "activeSearchEngine": "google",
    "sortByVisits": true
  },
  "sites": [],
  "todos": [],
  "notes": [],
  "bookmarks": []
}
```

* **No External Database Required:** The server reads and writes synchronously/debounced to this single JSON file.
* **Auto-Creation on Boot:** If `data/storage.json` is missing when cloning this repo, `server.js` automatically initializes it with clean defaults.
* **Privacy by Default on Git:**
  - The repository's tracked `data/storage.json` contains an empty template (`bookmarks: []`).
  - When you run the project locally, your browser bookmarks (from Chrome, Edge, and Brave) are imported into your local `data/storage.json`.
  - Git's `skip-worktree` attribute (`git update-index --skip-worktree data/storage.json`) ensures that your private imported bookmarks are **never committed or pushed to public GitHub repositories**.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `Ctrl + K` or `/` | Dashboard & Bookmarks | Focus search input bar immediately |
| `Esc` | Anywhere | Clear search bar / Close any open modal |
| `Enter` | To-Do Form | Add new to-do task |
| `Enter` | Search Bar | Execute search or open direct URL |
| `!g <query>` | Search Bar | Search using Google |
| `!d <query>` | Search Bar | Search using DuckDuckGo |
| `!b <query>` | Search Bar | Search using Bing |
| `!y <query>` | Search Bar | Search using YouTube |
| `!gh <query>` | Search Bar | Search using GitHub |
| `!r <query>` | Search Bar | Search using Reddit |
| `!w <query>` | Search Bar | Search using Wikipedia |
| `!br <query>` | Search Bar | Search using Brave Search |

---

## 🧪 Automated Test Suite

The project includes an end-to-end automated test suite built with Node.js's native test runner (`node:test`) and native assertions (`node:assert`):

```bash
# Run all tests
npm test

# Or directly with node
node --test tests/*.test.js
```

### Included Test Suites (45 Passing Tests)
1. **`tests/server-api.test.js` (18 tests):** Validates all REST API endpoints, CORS preflight headers, persistence, error responses, and static MIME delivery.
2. **`tests/realtime-sync.test.js` (4 tests):** Tests multi-browser synchronization by connecting 3 distinct clients simultaneously to the SSE stream and verifying real-time broadcast delivery.
3. **`tests/frontend-logic.test.js` (14 tests):** Tests search engine prefix routing, URL auto-detection, XSS sanitization, and sorting logic.
4. **`tests/browser-e2e.test.js` (9 tests):** Real headless browser test suite driving Chrome via DevTools Protocol (CDP) to verify DOM rendering, UI clicks, clear button UX, theme switching, to-do interactions, viewport-locked layout, and multi-tab live sync.
