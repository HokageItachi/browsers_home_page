# 🌐 Browser Home Page Hub, Bookmarks Library & Encrypted Vault

> **A modern, high-performance local dashboard, universal bookmarks hub, and zero-knowledge encrypted password vault built for power users and multi-browser workflows.**
> Built with pure Node.js standard libraries (**zero external npm dependencies**), native Server-Sent Events (SSE), and AES-256-GCM authenticated encryption. Everything you do—updating tasks, editing notes, visiting sites, managing bookmarks, or unlocking your vault—**synchronizes in real time across any number of open browsers and tabs** (Chrome, Edge, Brave, Firefox).

---

## 📑 Table of Contents

- [✨ Core Features](#-core-features)
  - [⚡ Instant Multi-Browser Real-Time Sync](#-instant-multi-browser-real-time-sync)
  - [🔖 Universal Bookmarks Hub & Auto-Import Scanner](#-universal-bookmarks-hub--auto-import-scanner)
  - [🔑 Encrypted Password Vault & Zero-Knowledge Security](#-encrypted-password-vault--zero-knowledge-security)
  - [🧭 Unified Centered Navigation Header](#-unified-centered-navigation-header)
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
- [🛡️ Cryptography & Security Hardening](#️-cryptography--security-hardening)
- [🔒 Data Privacy & Storage Architecture](#-data-privacy--storage-architecture)
- [⌨️ Keyboard Shortcuts](#️-keyboard-shortcuts)
- [🧪 Automated Test Suite (100 Passing Tests)](#-automated-test-suite-100-passing-tests)
- [📚 Engineering Documentation (`docs/`)](#-engineering-documentation-docs)

---

## ✨ Core Features

### ⚡ Instant Multi-Browser Real-Time Sync
* **Native Server-Sent Events (SSE):** No heavy WebSockets or socket libraries. Browsers maintain a single lightweight HTTP stream (`/api/events`).
* **Zero-Reload Experience:** Add a task in **Google Chrome**, edit a sticky note in **Brave**, or manage passwords in **Microsoft Edge**—every open tab and window reflects changes immediately.
* **Smart Concurrency & Focus Preservation:** Sticky notes and inputs preserve active cursor position even when background sync broadcasts arrive from another window.

---

### 🔖 Universal Bookmarks Hub & Auto-Import Scanner
A dedicated, full-featured bookmarks manager (`/bookmarks.html`) accessible via the centered navigation bar.

* **Automatic Background Scanning:** The server periodically scans local bookmark files from **Google Chrome**, **Microsoft Edge**, and **Brave Browser** every 30 seconds (`bookmark-scanner.js`).
* **Browser & Profile Separation:** Bookmarks are categorized by browser and human-readable profile names detected from `Local State` (e.g. `Brave — Personal`, `Edge — Work`, `Chrome — Default`).
* **One-Way Import Guarantee:** New bookmarks added in any browser are auto-imported. Deleting or editing a bookmark in this dashboard is local and **never modifies or deletes your actual browser bookmark files**.
* **3 Dedicated View Modes:**
  * 🔲 **Spacious Cards Grid (`view-grid`):** Card layout with 2-line title clamps, squircle favicons, direct domain links, browser source badges, and breadcrumb tags.
  * 📑 **Multi-Column Detailed List (`view-list`):** Table format with sticky headers (`Bookmark & Domain`, `Browser / Profile`, `Folder Path`, `Added Date`, `Actions`) aligned via CSS Grid.
  * 📄 **Razor-Sharp Compact View (`view-compact`):** High-density single-line rows for fast scanning through hundreds of items.
* **Quick Filter Chips:** Instant one-click browser pills (`All`, `Brave`, `Chrome`, `Edge`) for fast cross-browser filtering.
* **Instant Sorting:** Sort by *Newest First*, *Oldest First*, *Title (A → Z / Z → A)*, or *Domain / Site*.
* **Micro-Actions on Every Item:**
  * 📋 **Copy Link:** Copies clean URL to clipboard with floating feedback toast notification (`Link copied to clipboard ✓`).
  * ↗ **Open Link:** Opens URL in a new tab.
  * ✏️ **Edit:** Modify title, URL, or custom collection.
  * 🗑️ **Delete:** Remove bookmark from your local library with confirmation.

---

### 🔑 Encrypted Password Vault & Zero-Knowledge Security
A complete, secure password vault (`/passwords.html`) designed for local privacy without cloud dependence.

* **AES-256-GCM Storage Encryption:** All stored passwords in `data/storage.json` are encrypted using authenticated AES-256-GCM (`enc:iv:tag:ciphertext`). Plaintext passwords are **never written to disk**.
* **Master Password & PBKDF2 Key Derivation:** Cryptographic key derived using 100,000 iterations of HMAC-SHA512 with a cryptographically secure 16-byte random salt.
* **Zero-Knowledge Locked Mode:**
  * When the vault is locked, the backend sanitizes all password payloads to empty strings (`password: ""`) while passing a boolean `hasPassword: true/false`.
  * The frontend distinguishes accounts with encrypted passwords (displaying a neutral `🔒 Encrypted` badge and `🔒 Locked` preview) from accounts without passwords (displaying an `Empty` badge).
  * Strength scores for encrypted items remain concealed with `🔒` until unlocked with the correct Master Password.
* **Master Password Management:**
  * First-time setup wizard with confirmation checks.
  * Lock and Unlock controls directly from the header.
  * Secure **Change Master Password** workflow that verifies current password, derives a new key with a fresh salt, and re-encrypts all vault entries atomically.
* **Chromium Password Scanner (`password-scanner.js`):**
  * Auto-discovers saved credentials from local Chrome, Edge, and Brave profile SQLite `Login Data` databases using native Windows DPAPI decryption.
  * Deduplicates records by origin URL and username.
* **Strength Health Matrix:**
  * Real-time categorization into **Strong**, **Medium**, **Weak**, and **Empty** filters.
  * Entropy calculator checking length, lowercase, uppercase, digits, symbols, and common repetitive patterns.
* **Import & Export:**
  * Export unlocked passwords to JSON or CSV.
  * Bulk import accounts with automatic validation and immediate on-the-fly AES-256-GCM encryption.

---

### 🧭 Unified Centered Navigation Header
A persistent 3-pill switcher embedded in the exact center of all three pages:

```
[ 🏠 Home ]   [ 🔖 Bookmarks ]   [ 🔑 Passwords ]
```

* **True Center Alignment:** Built with balanced 3-column flex layouts (`flex: 1` on left and right) across `index.html`, `bookmarks.html`, and `passwords.html`.
* **Active State Pill:** Clearly highlights the current page with glowing primary accents.
* **Responsive Layout:** Automatically scales and adapts gracefully on mobile devices and narrow windows.

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
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                Client Browsers & Tabs                                   │
│   [ 🏠 Dashboard Home ]        [ 🔖 Bookmarks Library ]       [ 🔑 Password Vault ]     │
│   Chrome / Brave / Edge / Firefox                                                       │
└────────────────────────────┬───────────────────────────────┬────────────────────────────┘
                             │                               │
            HTTP REST (CRUD) │                               │ EventSource (SSE)
            Payloads         │                               │ Instant Live Broadcast
                             ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           Local Node.js Server (Port 48173)                             │
│                                                                                         │
│  ├── Static File Server (HTML, CSS, JS with Path Traversal Protection)                  │
│  ├── Unified Centered Header Navigation across all 3 HTML views                        │
│  ├── REST API Router (/api/todos, /api/notes, /api/sites, /api/bookmarks, /api/passwords)│
│  ├── SSE Broadcaster (Push state changes to all connected tabs simultaneously)          │
│  └── Crypto Security Layer (PBKDF2-HMAC-SHA512 + AES-256-GCM Authenticated Encryption)  │
└────────────────────────────┬───────────────────────────────┬────────────────────────────┘
                             │                               │
        Encrypted Read/Write │                               │ Read SQLite & JSON Files
                             ▼                               ▼
                 ┌───────────────────────┐       ┌───────────────────────────────┐
                 │   data/storage.json   │       │   Chromium User Data Dirs     │
                 │ (Encrypted at Rest)   │       │  Chrome / Brave / Edge        │
                 │  - Settings & Sites   │       │  - Bookmarks JSON             │
                 │  - Todos & Notes      │       │  - Login Data (DPAPI SQLite)  │
                 │  - Bookmarks & Vault  │       └───────────────────────────────┘
                 └───────────────────────┘
```

1. **`server.js`** starts a zero-dependency HTTP server on port `48173`.
2. When any browser connects, it establishes an **EventSource** connection to `/api/events`.
3. Every mutation writes to `data/storage.json` and broadcasts an SSE event to all connected browser windows.
4. **`bookmark-scanner.js`** scans Chrome, Edge, and Brave every 30 seconds and deduplicates new bookmarks into storage.
5. **`password-scanner.js`** discovers browser-saved passwords via DPAPI and securely encrypts them with AES-256-GCM before saving.

---

## 📁 Project Directory Structure

```
browser_home_page/
├── .gitignore                    # Protects sensitive data, keys, and private credentials
├── AGENTS.md                     # Strict security rules for AI assistants (never leak passwords)
├── bookmark-scanner.js           # Chromium browser bookmark auto-scanner & deduplicator
├── launch.ps1                    # Background unlock launcher (port checking & dedup)
├── package.json                  # Project metadata and native test runner scripts
├── password-scanner.js           # Chromium password scanner with Windows DPAPI decryption
├── README.md                     # Comprehensive project documentation
├── server.js                     # Zero-dependency Node.js HTTP, SSE & Crypto server
├── start.bat                     # 1-click Windows batch launcher
├── data/
│   ├── storage.example.json      # Clean template for Git tracking (empty arrays)
│   ├── storage.json              # Local persistent database (ignored by Git)
│   └── storage.local.json        # Local runtime state overrides (ignored by Git)
├── docs/
│   ├── algorithms.md             # W's & H's of PBKDF2, AES-256-GCM, entropy & ranking
│   ├── architectures.md          # Multi-process, SSE sync, storage & security architecture
│   ├── problem-faced.md          # Historical bugs, memory leaks, concurrency & DPAPI issues
│   ├── TASK_SCHEDULER_SETUP.md   # Windows Task Scheduler step-by-step configuration
│   ├── techniques.md             # Zero-dependency, memory safety, and CSS grid techniques
│   ├── TROUBLESHOOTING.md        # Network & port exclusion troubleshooting guide
│   └── unique-features.md        # Deep dive on 8 unique architectural capabilities
├── public/
│   ├── index.html                # Main dashboard page
│   ├── bookmarks.html            # Standalone Universal Bookmarks Hub
│   ├── passwords.html            # Standalone Encrypted Password Vault
│   ├── css/
│   │   ├── style.css             # Dashboard stylesheet & theme definitions
│   │   ├── bookmarks.css         # Bookmarks hub styles (Grid, Table List, Compact)
│   │   └── passwords.css         # Password vault styles (Badges, Health, Modals)
│   └── js/
│       ├── app.js                # Dashboard client logic & SSE listeners
│       ├── bookmarks.js          # Bookmarks client logic & controllers
│       └── passwords.js          # Password vault client logic & strength analyzer
└── tests/
    ├── browser-e2e.test.js       # Headless Chrome DevTools Protocol UI/UX tests (9 tests)
    ├── frontend-logic.test.js    # Unit tests for search routing, URLs, and XSS (14 tests)
    ├── passwords-api.test.js     # Password Manager API & Scanner test suite (12 tests)
    ├── realtime-sync.test.js     # Real-time multi-client SSE synchronization tests (4 tests)
    ├── security-hardening.test.js# Path traversal, XSS injection & prototype pollution (35 tests)
    ├── security-vault.test.js    # Vault cryptographic integrity & key rotation (8 tests)
    └── server-api.test.js        # REST API endpoint and persistence tests (18 tests)
```

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** (v18.0.0 or higher recommended, zero npm installs required)

### 1. Start the Server
Double-click `start.bat` or run in terminal:
```bash
node server.js
```

### 2. Access the Application
Open any web browser and navigate to:
* **Dashboard:** [http://localhost:48173](http://localhost:48173)
* **Bookmarks Hub:** [http://localhost:48173/bookmarks.html](http://localhost:48173/bookmarks.html)
* **Password Vault:** [http://localhost:48173/passwords.html](http://localhost:48173/passwords.html)

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

The server starts automatically in the background whenever you unlock your Windows workstation:
* The `launch.ps1` script checks if port `48173` is already listening.
* If listening: exits silently without console flashes.
* If stopped: boots `start.bat` cleanly.

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

> For detailed troubleshooting and port diagnostics, refer to [docs/TASK_SCHEDULER_SETUP.md](docs/TASK_SCHEDULER_SETUP.md).

---

## 🔌 REST API & SSE Endpoints Reference

All endpoints accept and return JSON with standard CORS support.

### 🌐 Core & Real-Time Sync
| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/events` | Server-Sent Events (SSE) real-time stream | *None (text/event-stream)* |
| `GET` | `/api/state` | Retrieves complete snapshot of settings, sites, todos, notes, bookmarks | *None* |
| `PUT` | `/api/settings` | Updates application settings (theme, search engine, sorting) | `{"theme": "dark", "activeSearchEngine": "google"}` |

### 🔥 Sites, To-Dos & Sticky Notes
| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
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

### 🔖 Bookmarks Management
| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/bookmarks` | Returns all imported and custom bookmarks | *None* |
| `POST` | `/api/bookmarks` | Manually creates a new bookmark | `{"title": "React Docs", "url": "https://react.dev", "group": "Docs"}` |
| `PUT` | `/api/bookmarks/:id`| Updates bookmark title, URL, or collection | `{"title": "New Title", "group": "Dev"}` |
| `DELETE`| `/api/bookmarks/:id`| Deletes a bookmark | *None* |
| `PUT` | `/api/bookmarks/groups/rename` | Renames a collection across all bookmarks | `{"oldName": "Docs", "newName": "Documentation"}` |
| `DELETE`| `/api/bookmarks/groups/:group` | Deletes all bookmarks inside a collection | *None* |

### 🔑 Passwords & Encrypted Vault
| Method | Endpoint | Description | Payload Example |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/passwords/vault/status` | Returns vault status (`configured`, `unlocked`) | *None* |
| `POST` | `/api/passwords/vault/setup` | Initializes Master Password for the first time | `{"masterPassword": "SecretPassword123!"}` |
| `POST` | `/api/passwords/vault/unlock` | Unlocks vault using Master Password | `{"masterPassword": "SecretPassword123!"}` |
| `POST` | `/api/passwords/vault/lock` | Locks vault and purges in-memory keys | *None* |
| `POST` | `/api/passwords/vault/change-master` | Verifies current key and re-encrypts all items | `{"currentPassword": "...", "newPassword": "..."}` |
| `GET` | `/api/passwords` | Returns accounts (sanitized when locked) | *None* |
| `POST` | `/api/passwords` | Creates and encrypts a new password | `{"title": "GitHub", "username": "dev", "password": "..."}` |
| `PUT` | `/api/passwords/:id` | Updates entry details or password | `{"title": "GitHub", "username": "dev"}` |
| `DELETE`| `/api/passwords/:id` | Deletes entry | *None* |
| `POST` | `/api/passwords/import` | Bulk imports accounts with immediate encryption | `{"items": [...]}` |
| `POST` | `/api/passwords/sync` | Triggers Chromium DPAPI password scanner | *None* |

---

## 🛡️ Cryptography & Security Hardening

The application is hardened against local and network attack vectors:

1. **Authenticated AES-256-GCM Encryption:**
   - Passwords stored in `data/storage.json` use the format `enc:<iv_hex>:<tag_hex>:<ciphertext_hex>`.
   - Each entry uses an independently generated 12-byte cryptographic IV (`crypto.randomBytes(12)`).
   - Any bit tampering or payload corruption fails decryption immediately via GCM authentication tags.
2. **PBKDF2 Key Stretching:**
   - 100,000 rounds of HMAC-SHA512 with a 16-byte random salt derive the 256-bit symmetric key.
3. **Zero-Knowledge Locked Sanitization:**
   - While the vault is locked, `password` fields sent to clients are sanitized to `""`.
   - A boolean `hasPassword` flag enables UI badges without exposing ciphertexts or plaintexts.
4. **Path Traversal Shield:**
   - Static file server normalizes URL paths and strictly prevents directory traversal attacks (e.g. `/../server.js`, `/%2e%2e/data/storage.json`).
5. **Prototype Pollution Protection:**
   - JSON deserialization and state updates filter out `__proto__`, `constructor`, and `prototype` keys.
6. **Payload Guard:**
   - HTTP body parser enforces a 5MB payload limit, returning `413 Request Entity Too Large` on oversized requests.
7. **Cross-Site Scripting (XSS) Sanitization:**
   - Native HTML entity encoder neutralizes `<`, `>`, `&`, `"`, and `'`. Dangerous pseudo-protocols (`javascript:`, `data:`, `file:`) are strictly forbidden.

---

## 🔒 Data Privacy & Storage Architecture

### How Local Storage Works
All application state is saved locally in `data/storage.json`:

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
  "bookmarks": [],
  "passwords": [],
  "vault_meta": {
    "configured": true,
    "salt": "<16_byte_hex>",
    "verifier": "<hmac_sha256_hex>"
  }
}
```

* **Zero Cloud Dependence:** Works 100% offline. No telemetry, third-party analytics, or remote API calls.
* **Privacy by Default on Git:**
  - `data/storage.json` is untracked and excluded in `.gitignore`.
  - Only `data/storage.example.json` (a clean template without personal data) is tracked by Git.
  - Strict guidelines in [`AGENTS.md`](AGENTS.md) protect user credentials from ever being dumped into logs or commits.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `Ctrl + K` or `/` | Dashboard, Bookmarks & Passwords | Focus search input bar immediately |
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

## 🧪 Automated Test Suite (100 Passing Tests)

The project includes an end-to-end automated test suite built with Node.js's native test runner (`node:test`) and native assertions (`node:assert`):

```bash
# Run all tests
npm test

# Or directly with node
node --test tests/*.test.js
```

### Complete Test Coverage Across 9 Suites (100 Tests)
1. **`tests/browser-e2e.test.js` (9 tests):** Real headless browser test suite driving Chrome via DevTools Protocol (CDP) to verify DOM rendering, live clock, sync badges, clear button UX, theme switching, to-do operations, note creation, viewport-locked layout, and multi-tab live sync.
2. **`tests/frontend-logic.test.js` (14 tests):** Tests search engine prefix routing (`!g`, `!yt`, etc.), URL auto-detection, XSS escaping, and sorting algorithms.
3. **`tests/passwords-api.test.js` (12 tests):** Tests static asset delivery, CRUD password endpoints, bulk import, category renaming, scanner initialization, and vault setup/locking/unlocking.
4. **`tests/realtime-sync.test.js` (4 tests):** Tests multi-browser synchronization by connecting 3 distinct clients simultaneously to the SSE stream and verifying cross-client broadcast delivery.
5. **`tests/security-hardening.test.js` (35 tests):**
   - **Static Path Traversal Protection (19 tests):** Tests resistance against URL-encoded, backslash, and nested traversal attempts (`/../server.js`, `/%2e%2e/etc/passwd`, `/data/storage.json`).
   - **Search Routing & XSS Escaping (7 tests):** Neutralizes malicious schemes (`javascript:`, `file:`) and verifies full HTML entity encoding.
   - **API Robustness & Prototype Pollution (9 tests):** Enforces 400 bad JSON handling, 413 oversized body handling, 404 route handling, and blocks `__proto__` contamination.
6. **`tests/security-vault.test.js` (8 tests):** Validates vault cryptographic integrity: weak password rejection, AES-256-GCM ciphertext verification, locked read/write blocks, wrong password rejection, and key rotation.
7. **`tests/server-api.test.js` (18 tests):** Validates all core REST API endpoints, CORS preflight headers, persistence, error responses, and static MIME delivery.

---

## 📚 Engineering Documentation (`docs/`)

For in-depth architectural and algorithmic documentation, explore the `docs/` folder:

* 🧮 [**`docs/algorithms.md`**](docs/algorithms.md): Detailed 5 W's & 1 H explanations of PBKDF2, AES-256-GCM, HMAC verification, Chromium DPAPI extraction, entropy scoring, debouncing, and ranking.
* 🏛️ [**`docs/architectures.md`**](docs/architectures.md): Architecture breakdown covering multi-process design, SSE broadcast protocol, zero-dependency storage, and security threat modeling.
* 🛠️ [**`docs/techniques.md`**](docs/techniques.md): Software engineering techniques: zero-dependency Node.js, resilient SSE reconnections, viewport-locked CSS, and safe DPAPI integration.
* ⚠️ [**`docs/problem-faced.md`**](docs/problem-faced.md): Real-world engineering challenges solved: SSE memory leaks, cursor jumps during sync, DPAPI Windows architecture mismatches, and race conditions.
* 🌟 [**`docs/unique-features.md`**](docs/unique-features.md): Deep dive into 8 unique architectural capabilities that set this project apart from standard dashboard templates.
* ⚙️ [**`docs/TASK_SCHEDULER_SETUP.md`**](docs/TASK_SCHEDULER_SETUP.md): Guide for configuring background execution on Windows workstation unlock.
* 🔍 [**`docs/TROUBLESHOOTING.md`**](docs/TROUBLESHOOTING.md): Port conflict and Windows firewall troubleshooting guide.
