# ⚠️ Problems Faced & Technical Solutions

This document catalogs the real-world engineering obstacles encountered during the architecture, development, and hardening of the Browser Home Page Hub, along with the precise solutions implemented. Each challenge is documented using the **5 W's and 1 H framework** (**What, Why, Where, When, Who, How**).

---

## 📑 Table of Contents

1. [Chrome v127+ App-Bound Encryption vs Legacy DPAPI](#1-chrome-v127-app-bound-encryption-vs-legacy-dpapi)
2. [Windows EADDRINUSE Port Collision & Orphaned Processes](#2-windows-eaddrinuse-port-collision--orphaned-processes)
3. [Multi-Tab SSE Infinite Broadcast Loop & Typing Jitter](#3-multi-tab-sse-infinite-broadcast-loop--typing-jitter)
4. [PowerShell Command-Line String Escaping in Windows Subprocesses](#4-powershell-command-line-string-escaping-in-windows-subprocesses)
5. [Accidental Git Leakage of Live User Credentials](#5-accidental-git-leakage-of-live-user-credentials)

---

## 1. Chrome v127+ App-Bound Encryption vs Legacy DPAPI

### 🔍 5 W's and 1 H Overview
* **What:** Google Chrome version 127 and newer introduced **App-Bound Encryption**, an elevated Windows system service that encrypts the browser master key with a system service token instead of direct user-level DPAPI.
* **Why:** To defend browser profiles from infostealer malware running under the user's desktop session. Because of this, standard `CryptUnprotectData` fails to decrypt Chrome's `os_crypt.encrypted_key`, throwing `ACCESS_DENIED`.
* **Where:** `password-scanner.js` (`scanChromePasswords()`, `scanEdgePasswords()`).
* **When:** Occurs when running the password scanner against Chrome v127+ profiles on Windows 10/11 (Microsoft Edge and older Chrome versions still use standard DPAPI).
* **Who:** Users attempting to auto-sync passwords from recent Google Chrome installations.
* **How (Solution):**
  1. **Graceful Error Recovery:** The scanner detects App-Bound encryption prefixes (`APPB`) and logs a descriptive diagnostic instead of crashing the server process.
  2. **Profile Fallback Strategy:** The scanner continues scanning all other non-App-Bound profiles (Microsoft Edge, Brave, and secondary profiles).
  3. **Universal CSV Import / Export:** Implemented a robust client-side CSV parser (`POST /api/passwords/import`) in `passwords.html`. Users can export Chrome's passwords to CSV once, click **Import Passwords**, and immediately have them encrypted into the AES-256-GCM vault with zero plaintext storage.

---

## 2. Windows EADDRINUSE Port Collision & Orphaned Processes

### 🔍 5 W's and 1 H Overview
* **What:** The server fails to start with `Error: listen EADDRINUSE: address already in use :::48173`.
* **Why:** When Node.js crashes, restarts, or runs automated tests, Windows may not immediately release TCP sockets if child processes (like PowerShell or headless Chrome) hold inherited file descriptors.
* **Where:** `server.js`, `launch.ps1`, `tests/*.test.js`.
* **When:** During quick test cycles, server restarts, or Windows PC sleep/resume transitions.
* **Who:** Developers and end users launching the app via `start.bat`.
* **How (Solution):**
  1. **Automated Port Cleaner in Launcher:** Updated `launch.ps1` to detect any process occupying port 48173 using `Get-NetTCPConnection` and terminate it gracefully before launching:
     ```powershell
     $port = 48173
     $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
     if ($conn) {
       Stop-Process -Id $conn.OwningProcess -Force
     }
     ```
  2. **Dynamic Ephemeral Ports for Automated Testing:** All test suites in `tests/` instantiate `createApp()` with `port: 0` (or isolated ephemeral ports), preventing tests from colliding with a running production dashboard instance.

---

## 3. Multi-Tab SSE Infinite Broadcast Loop & Typing Jitter

### 🔍 5 W's and 1 H Overview
* **What:** When a user edited a sticky note in Tab 1, Tab 1 received its own echo event from the server, causing the textarea to re-render, jump the cursor to the beginning of the text, and drop typed characters.
* **Why:** In a naive SSE pub/sub implementation, calling `broadcast("notes_updated", state.notes)` sends the message to *all* open sockets, including the client that initiated the update.
* **Where:** `server.js` (`broadcast()`), `public/js/app.js` (`CLIENT_ID`).
* **When:** While typing in sticky notes, search inputs, or task names with multiple tabs open.
* **Who:** Any user typing in the dashboard.
* **How (Solution):**
  1. **Client ID Assignment:** Every client tab generates a unique `CLIENT_ID = 'client_' + Math.random().toString(36).substr(2, 9)` on page load.
  2. **Header Propagation:** Every AJAX request attaches the header `X-Client-ID: <CLIENT_ID>`.
  3. **Sender Exclusion Broadcast:**
     ```javascript
     function broadcast(event, data, originClientId = null) {
       for (const client of clients) {
         if (originClientId && client.id === originClientId) continue; // Exclude origin!
         client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
       }
     }
     ```
  4. The originating tab updates its local DOM optimistically, while external tabs update smoothly without echo collisions.

---

## 4. PowerShell Command-Line String Escaping in Windows Subprocesses

### 🔍 5 W's and 1 H Overview
* **What:** The password scanner failed with syntax errors when scanning Windows user profiles containing spaces, apostrophes, or non-ASCII characters (e.g. `C:\Users\John O'Connor\AppData\...`).
* **Why:** Passing raw string arguments through `child_process.execSync` interpolates shell quotes into Windows PowerShell, causing broken command tokens.
* **Where:** `password-scanner.js` (`decryptChromiumMasterKey()`).
* **When:** Initializing background sync on systems with custom Windows user folder names.
* **Who:** Users with spaces or special characters in their Windows username.
* **How (Solution):**
  1. **Base64 Parameter Passing:** Instead of passing raw strings or file paths into the PowerShell command line, the scanner Base64-encodes the binary payloads inside Node.js.
  2. **Direct CLI Decoding:** Inside the PowerShell command line, strings are unwrapped using `[Convert]::FromBase64String(...)`:
     ```javascript
     const b64 = Buffer.from(encryptedKey).toString('base64');
     const cmd = `powershell -NoProfile -Command "[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String('${b64}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))"`;
     ```
  3. This completely prevents command injection and shell syntax errors.

---

## 5. Accidental Git Leakage of Live User Credentials

### 🔍 5 W's and 1 H Overview
* **What:** The risk of staging and pushing personal passwords, notes, and browsing history stored in `data/storage.json` to public or shared GitHub repositories.
* **Why:** In local development, developers frequently run `git add .` or `git commit -a`, which could inadvertently commit unencrypted or sensitive user files.
* **Where:** `.gitignore`, `data/storage.json`, `data/storage.example.json`, and `AGENTS.md`.
* **When:** During code changes, feature development, or test execution.
* **Who:** Any developer, contributor, or autonomous AI agent working on the codebase.
* **How (Solution):**
  1. **Permanent Git Exclusion:** Added `data/storage.json` and `data/storage.local.json` to `.gitignore`.
  2. **Index Untracking:** Ran `git rm --cached data/storage.json` to ensure Git never tracks local modifications.
  3. **Sanitized Template (`storage.example.json`):** Created a clean, version-controlled template containing only dummy starter sites and bookmarks.
  4. **Strict `AGENTS.md` Policy:** Codified automated rules forbidding AI agents from ever dumping, committing, or logging credentials.
  5. **AES-256-GCM Vault Protection:** Even if `storage.json` were somehow transferred, passwords on disk are encrypted with AES-256-GCM and unreadable without the master password.
