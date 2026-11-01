# 🛠️ Engineering Techniques

This document details specialized implementation techniques, frontend patterns, and system interop methods developed for the Browser Home Page Hub. Every technique is analyzed through the **5 W's and 1 H framework** (**What, Why, Where, When, Who, How**).

---

## 📑 Table of Contents

1. [Focus-Preserving DOM Reconciliation](#1-focus-preserving-dom-reconciliation)
2. [Native Windows DPAPI Extraction Without Node-GYP C++](#2-native-windows-dpapi-extraction-without-node-gyp-c)
3. [Two-Tier Responsive Navigation Header](#3-two-tier-responsive-navigation-header)
4. [Flash-Free (Anti-FOUC) Tokenized Theming](#4-flash-free-anti-fouc-tokenized-theming)
5. [Lightweight Relative Time & Hostname Parsing](#5-lightweight-relative-time--hostname-parsing)
6. [Defense-in-Depth HTML Sanitization & XSS Prevention](#6-defense-in-depth-html-sanitization--xss-prevention)

---

## 1. Focus-Preserving DOM Reconciliation

### 🔍 5 W's and 1 H Overview
* **What:** A frontend DOM update technique that checks `document.activeElement` before re-rendering components received from background Server-Sent Events (SSE).
* **Why:** In multi-browser real-time dashboards, an incoming update from another window can re-render the DOM tree. If the user is actively typing inside a sticky note or search input, a naive `.innerHTML = ...` replacement will wipe focus, reset cursor position, and frustrate the user.
* **Where:** `public/js/app.js` (`renderNotes()`, `renderTodos()`).
* **When:** Executed whenever an SSE update arrives while a user is actively typing or editing.
* **Who:** Any user multi-tasking across open browser windows.
* **How:**
  1. Before modifying the note list DOM, the function captures the active element's identity:
     ```javascript
     const activeEl = document.activeElement;
     const isEditingNote = activeEl && activeEl.classList.contains('note-textarea');
     const editingNoteId = isEditingNote ? activeEl.dataset.id : null;
     ```
  2. The DOM reconciler iterates through items:
     - For notes not currently focused, it updates their text and background color normally.
     - For the note matching `editingNoteId`, it **preserves the textarea**, skipping replacement of its value and caret position.
  3. This achieves smooth multi-tab sync without disrupting user keystrokes.

---

## 2. Native Windows DPAPI Extraction Without Node-GYP C++

### 🔍 5 W's and 1 H Overview
* **What:** Executing lightweight Windows PowerShell CLI one-liners to invoke `System.Security.Cryptography.ProtectedData` directly, bypassing native C++ binary addons (`node-gyp`).
* **Why:** Native C++ addons require Python, Visual Studio C++ Build Tools, and compilation upon `npm install`. This fails on typical user machines. PowerShell is natively pre-installed on $100\%$ of modern Windows PCs.
* **Where:** `password-scanner.js` (`decryptChromiumMasterKey()`).
* **When:** During initial profile scanning and background credential sync.
* **Who:** Windows desktop users without developer build environments.
* **How:**
  1. The scanner reads the encrypted master key bytes from Chromium's `Local State` JSON file.
  2. It strips the 5-byte `"DPAPI"` prefix.
  3. It executes a clean synchronous child process call:
     ```powershell
     powershell -NoProfile -Command "Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String('$b64'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))"
     ```
  4. The returned Base64 string is decoded into a 32-byte raw key buffer, ready for AES-256-GCM password decryption without any external compilation.

---

## 3. Two-Tier Responsive Navigation Header

```
 Tier 1 (Global Brand & Page Switcher):
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 🌐 Browser Hub  [ 🏠 Home ]  [ 🔖 Bookmarks ]  [ 🔑 Passwords ]  🌙 🔒 │
 └────────────────────────────────────────────────────────────────────────┘
 Tier 2 (Action & Filter Toolbar):
 ┌────────────────────────────────────────────────────────────────────────┐
 │ 🔍 [ Search items... (Ctrl+K) ]  [Grid|List|Compact]  [+ Add] [⚡ Sync]│
 └────────────────────────────────────────────────────────────────────────┘
```

### 🔍 5 W's and 1 H Overview
* **What:** A two-tier header layout splitting top-level navigation (Tier 1) from contextual search, sorting, view switchers, and action buttons (Tier 2).
* **Why:** Combining search bars, 3 view mode toggles, filter pills, import/export buttons, vault status, theme switcher, and multi-page links into a single row causes severe button collision, horizontal overflow, and poor usability on screens $< 1400\text{px}$.
* **Where:** `public/passwords.html`, `public/bookmarks.html`, `public/css/passwords.css`, `public/css/bookmarks.css`.
* **When:** Visible persistently at the top of the viewport.
* **Who:** User interacting with dense collections.
* **How:**
  - **Tier 1 (`.pm-nav-tier1`):** Fixed height (48px) with high z-index. Contains brand logo, 3-page pill navigation (`.app-nav-group`), vault security lock toggle, and light/dark theme switch.
  - **Tier 2 (`.pm-toolbar`):** Context-aware workspace controls containing the wide search bar (`Ctrl+K`), view switcher (Grid, List, Compact), category dropdowns, and primary action buttons (`+ Add Password`, `Sync Profiles`).

---

## 4. Flash-Free (Anti-FOUC) Tokenized Theming

### 🔍 5 W's and 1 H Overview
* **What:** Blocking inline theme initialization script placed at the top of `<head>` paired with CSS Custom Properties (variables) on `:root` and `[data-theme="light"]`.
* **Why:** When user settings are fetched asynchronously via `fetch('/api/settings')`, the page renders with the default dark theme for 100ms before flashing to light mode (Flash of Unstyled Content / FOUC).
* **Where:** In `<head>` of `index.html`, `bookmarks.html`, and `passwords.html`.
* **When:** Executed synchronously before the DOM starts painting.
* **Who:** Any user preferring light mode or working in bright environments.
* **How:**
  1. An inline script in `<head>` immediately queries localStorage:
     ```html
     <script>
       const savedTheme = localStorage.getItem('hub_theme') || 'dark';
       document.documentElement.setAttribute('data-theme', savedTheme);
     </script>
     ```
  2. CSS variables react instantly:
     ```css
     :root {
       --bg-body: #090d16;
       --text-main: #f1f5f9;
     }
     [data-theme="light"] {
       --bg-body: #f8fafc;
       --text-main: #0f172a;
     }
     ```
  3. When the page connects to SSE, any updated theme preference from other tabs is applied seamlessly without a page reload.

---

## 5. Lightweight Relative Time & Hostname Parsing

### 🔍 5 W's and 1 H Overview
* **What:** Pure JavaScript utility functions for relative human-friendly timestamps ("Just now", "5m ago", "2d ago") and clean domain extraction without date-fns, moment.js, or tldjs libraries.
* **Why:** Third-party date and URL libraries add hundreds of kilobytes of unnecessary bundle overhead for straightforward time calculations.
* **Where:** `public/js/app.js`, `public/js/bookmarks.js`, `public/js/passwords.js` (`formatRelativeTime()`, `getDomain()`).
* **When:** Rendering table rows, card badges, and metadata footers.
* **Who:** Frontend rendering pipeline.
* **How:**
  - **Relative Time:**
    ```javascript
    function formatRelativeTime(timestamp) {
      if (!timestamp) return '';
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days}d ago`;
      return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    ```
  - **Hostname Cleaner:** Uses native `new URL()` wrapped in a `try...catch` block, stripping `www.` prefixes to produce readable website labels.

---

## 6. Defense-in-Depth HTML Sanitization & XSS Prevention

### 🔍 5 W's and 1 H Overview
* **What:** Context-aware entity encoding function converting all dynamic user-provided strings into safe HTML text nodes.
* **Why:** Password titles, usernames, bookmark labels, and sticky notes can contain malicious HTML injection strings (e.g. `<script>alert(1)</script>` or `<img src=x onerror=...>`) designed to hijack local sessions or execute Cross-Site Scripting (XSS).
* **Where:** `public/js/app.js`, `public/js/bookmarks.js`, `public/js/passwords.js` (`escapeHtml()`).
* **When:** Before inserting any database record or user text into template literals.
* **Who:** All clients rendering stored records.
* **How:**
  ```javascript
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  ```
  All template interpolations wrap variables inside `${escapeHtml(item.field)}`, guaranteeing that injected payloads render harmlessly as plain text.
