# 🏛️ System & Software Architectures

This document outlines the high-level and component architectures of the Browser Home Page Hub, explained through the **5 W's and 1 H framework** (**What, Why, Where, When, Who, How**).

---

## 📑 Table of Contents

1. [Zero-Dependency Node.js Core Architecture](#1-zero-dependency-nodejs-core-architecture)
2. [Three-Page Unified MPA Architecture](#2-three-page-unified-mpa-architecture)
3. [Server-Sent Events (SSE) Real-Time Pub/Sub Architecture](#3-server-sent-events-sse-real-time-pubsub-architecture)
4. [Atomic File Persistence & Storage Architecture](#4-atomic-file-persistence--storage-architecture)
5. [Zero-Knowledge Password Vault Security Architecture](#5-zero-knowledge-password-vault-security-architecture)
6. [Non-Blocking Background Scanner Architecture](#6-non-blocking-background-scanner-architecture)

---

## 1. Zero-Dependency Node.js Core Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Pure Node.js Environment                        │
│                                                                        │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────────────┐   │
│   │   http   │   │    fs    │   │   path   │   │      crypto       │   │
│   │ (Server) │   │(Storage) │   │ (Routing)│   │(PBKDF2 / AES-GCM) │   │
│   └──────────┘   └──────────┘   └──────────┘   └───────────────────┘   │
│   ┌──────────┐   ┌─────────────────────────┐   ┌───────────────────┐   │
│   │    os    │   │      child_process      │   │   Zero External   │   │
│   │ (Paths)  │   │   (PowerShell Scanner)  │   │   NPM Packages    │   │
│   └──────────┘   └─────────────────────────┘   └───────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 🔍 5 W's and 1 H Overview
* **What:** An architectural design invariant where the entire backend server, REST API, SSE streaming, file scanner, and cryptographic vault run exclusively on standard Node.js built-in runtime modules without a single third-party npm package (`node_modules` is empty).
* **Why:** 
  1. **Supply Chain Security:** Zero risk of compromised packages, typosquatting, or transitive dependency vulnerabilities.
  2. **Instant Deployment & Portability:** Starts in $< 100\text{ms}$ with zero `npm install` steps required.
  3. **Zero Maintenance Bit-Rot:** Core Node APIs are long-term stable and do not break across runtime updates.
* **Where:** `server.js`, `bookmark-scanner.js`, `password-scanner.js`, and `package.json`.
* **When:** Active at all times during server initialization, request handling, and scanning cycles.
* **Who:** Developers, privacy-conscious users, and self-hosters.
* **How:**
  - HTTP routing, JSON request body parsing, static file MIME-type resolution, and CORS handling are implemented from scratch using `node:http`.
  - Cryptography relies on `node:crypto`.
  - File operations use `node:fs`.
  - Windows interop uses `node:child_process` and `node:os`.

---

## 2. Three-Page Unified MPA Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Unified Top Header Navigation                   │
│         [ 🏠 Home ]        [ 🔖 Bookmarks ]        [ 🔑 Passwords ]     │
└────────────────────────────────────────────────────────────────────────┘
        │                            │                           │
        ▼                            ▼                           ▼
 ┌───────────────┐           ┌───────────────┐           ┌───────────────┐
 │  index.html   │           │bookmarks.html │           │passwords.html │
 │  (Dashboard)  │           │(Bookmarks Hub)│           │(Password Vault│
 ├───────────────┤           ├───────────────┤           ├───────────────┤
 │ • Live Clock  │           │ • 3 View Modes│           │ • AES-256 Vault│
 │ • Search Bar  │           │ • Profile Tags│           │ • Pwd Gen & St│
 │ • Speed Dial  │           │ • Fast Filter │           │ • Import/Sync │
 │ • To-Do List  │           │ • Breadcrumbs │           │ • Vault Health│
 │ • Sticky Notes│           │ • Micro-action│           │ • Change Master│
 └───────────────┘           └───────────────┘           └───────────────┘
```

### 🔍 5 W's and 1 H Overview
* **What:** A Multi-Page Application (MPA) consisting of three dedicated views (`/`, `/bookmarks.html`, `/passwords.html`) linked by a shared two-tier navigation bar and unified design token system.
* **Why:** Single Page Applications (SPAs) bundling all dashboard, bookmark, and vault logic into one monolithic bundle lead to bloated memory, DOM clutter, and security leakage across views. An MPA separates concerns cleanly while keeping cross-page navigation instant.
* **Where:**
  - `public/index.html` (Home Hub & Daily Widgets)
  - `public/bookmarks.html` (Dedicated Universal Bookmark Library)
  - `public/passwords.html` (Encrypted Master Password Vault & Scanner)
  - `public/css/style.css`, `public/css/bookmarks.css`, `public/css/passwords.css`
* **When:** When a user navigates between features using the top pill buttons or browser URL.
* **Who:** The user operating their daily workspace.
* **How:**
  1. Each HTML page includes a shared `.app-nav-group` element styled with rounded pill buttons.
  2. The active page receives an `.active` pill class with emerald accent styling.
  3. Shared settings (e.g. `dark` vs `light` theme) are synchronized across all three pages in real time via Server-Sent Events.

---

## 3. Server-Sent Events (SSE) Real-Time Pub/Sub Architecture

```
 Browser Window 1 (Chrome)          Backend Server           Browser Window 2 (Edge)
┌───────────────────────┐       ┌──────────────────┐       ┌───────────────────────┐
│ User updates To-Do    │       │                  │       │ User is viewing page  │
│ POST /api/todos       │──────▶│ 1. Mutates State │       │                       │
│ (with X-Client-ID: A) │       │ 2. Persists Disk │       │                       │
│                       │       │ 3. Broadcasts    │──────▶│ Receives SSE Event    │
│ Ignores echo (self)   │◀─ ─ ─ │    (Excludes A)  │       │ Instant DOM update    │
└───────────────────────┘       └──────────────────┘       └───────────────────────┘
```

### 🔍 5 W's and 1 H Overview
* **What:** A persistent HTTP text-stream connection (`/api/events`) following the Server-Sent Events (W3C EventSource) specification for one-to-many publish/subscribe real-time broadcast.
* **Why:** Full-duplex WebSockets require extra protocol handshakes, ping-pong pingers, and external npm packages. SSE runs over vanilla HTTP, auto-reconnects natively in browsers, and operates with minimal memory footprint.
* **Where:** `server.js` (`/api/events` handler, `broadcast(event, data, originClientId)`).
* **When:** Active whenever any tab or browser is open. Broadcasts whenever a state mutation occurs (to-do toggled, note edited, bookmark imported, theme switched).
* **Who:** All connected client tabs across all installed browsers (Chrome, Edge, Brave, Firefox).
* **How:**
  1. **Connection Setup:** The browser opens `new EventSource('/api/events')`. The server responds with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive`.
  2. **Client Registration:** Each client is assigned a unique `clientId`. The client passes its ID in `X-Client-ID` headers for all subsequent REST mutations.
  3. **Echo Suppression:** When client $A$ mutates state, `broadcast(event, payload, originClientId = A)` sends the event to all active streams *except* client $A$. This prevents race conditions and typing jumps for the active user.
  4. **Keep-Alive Heartbeat:** The server transmits `:keepalive\n\n` comments every 20 seconds to prevent network proxy or browser timeout disconnection.

---

## 4. Atomic File Persistence & Storage Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Atomic File Save Sequence                       │
│                                                                        │
│ ┌───────────────┐      JSON Stringify       ┌────────────────────────┐ │
│ │ Memory State  │ ────────────────────────▶ │   Write to Temp File   │ │
│ │ (JS Object)   │                           │ (data/storage.json.tmp)│ │
│ └───────────────┘                           └────────────────────────┘ │
│                                                          │             │
│                                           fs.renameSync  │ (Atomic)    │
│                                                          ▼             │
│                                             ┌────────────────────────┐ │
│                                             │   Target Storage File  │ │
│                                             │   (data/storage.json)  │ │
│                                             └────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### 🔍 5 W's and 1 H Overview
* **What:** Disk serialization strategy utilizing temporary file staging (`storage.json.tmp`) followed by atomic rename (`fs.renameSync`) to ensure zero file corruption.
* **Why:** Writing directly to `storage.json` during unexpected power loss, system crash, or rapid concurrent write requests can lead to partially written (truncated/corrupted) JSON, destroying user notes and passwords.
* **Where:** `server.js` (`saveState()` function).
* **When:** Executed immediately whenever any in-memory state slice is modified.
* **Who:** Backend storage engine.
* **How:**
  1. State object is serialized via `JSON.stringify(state, null, 2)`.
  2. File is written to `data/storage.json.tmp` using UTF-8 encoding.
  3. Node.js executes `fs.renameSync(tempFile, targetFile)`. In modern OS file systems (NTFS/ext4/APFS), `rename` is an atomic directory table pointer update.
  4. `data/storage.json` is listed in `.gitignore` so user credentials and private notes are never committed to version control.

---

## 5. Zero-Knowledge Password Vault Security Architecture

```
 User Enters Master Password (Client)
                │
                │ HTTPS / Local Loopback
                ▼
      ┌──────────────────┐
      │ PBKDF2 Derivation│  (100,000 iterations + 16-byte random salt)
      └──────────────────┘
                │
                ▼
        Derived 256-bit Key (Stored in RAM ONLY)
          ├── Compute HMAC-SHA256 ──▶ Compares with storage.json testHash
          └── AES-256-GCM Cipher  ──▶ Encrypts/Decrypts storage.json payloads
                │
         [Lock Vault Trigger]
                ▼
        Key Cleared from RAM
```

### 🔍 5 W's and 1 H Overview
* **What:** Client-server zero-knowledge security architecture where stored passwords on disk are encrypted with AES-256-GCM, and neither the user's master password nor the derived cryptographic key is ever written to storage.
* **Why:** If the local PC is compromised or `storage.json` is stolen, attackers cannot read stored passwords without the user's master password.
* **Where:** `server.js` (`vault` state object, `activeVaultKey` memory reference), `public/js/passwords.js`.
* **When:** Vault setup, unlock, lock, and credential change lifecycles.
* **Who:** Security-conscious user managing local credentials.
* **How:**
  1. **At Rest:** On disk, password values have the format `enc:<iv>:<tag>:<ciphertext>`.
  2. **In Memory:** When unlocked, `activeVaultKey` lives exclusively in Node's volatile process memory.
  3. **Locking:** When locked, `activeVaultKey = null`. Subsequent `GET /api/passwords` returns masked placeholders (`🔒 Locked`).
  4. **Verification:** Vault verification uses a one-way HMAC-SHA256 hash (`testHash`).

---

## 6. Non-Blocking Background Scanner Architecture

```
 Node.js Main Thread                     Operating System Background
┌───────────────────────┐               ┌───────────────────────────────┐
│ HTTP API & SSE Engine │               │ Chromium User Profiles        │
│ (Always Responsive)   │               │ (AppData/Local/Google/Edge)   │
└───────────────────────┘               └───────────────────────────────┘
           │                                            ▲
           │ child_process.spawn                        │ Read Bookmarks
           ▼                                            │ & DPAPI SQLite
┌───────────────────────┐                               │
│  Child Scanner Task   │───────────────────────────────┘
│  (Isolated Subprocess)│
└───────────────────────┘
```

### 🔍 5 W's and 1 H Overview
* **What:** Decoupled background scanning process that reads local browser profile directories without blocking the main Node.js event loop or HTTP request serving.
* **Why:** Reading SQLite databases or searching large bookmark JSON trees across multiple browser profiles can take 500ms to 2 seconds. Running this on the main thread would freeze dashboard animations and delay API responses.
* **Where:** `bookmark-scanner.js` and `password-scanner.js`.
* **When:** Automatically runs on server startup, periodically on a timer (every 30 seconds for bookmarks), or on-demand via the UI "Sync" button.
* **Who:** Automated background worker.
* **How:**
  1. The server spawns the scanner using child process isolation or asynchronous I/O loops.
  2. The scanner accesses profile folders in `APPDATA` / `LOCALAPPDATA`.
  3. It performs read-only queries, computes unique hashes, merges new items into memory, and triggers an SSE broadcast only if new items were discovered.
