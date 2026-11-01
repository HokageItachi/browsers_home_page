# 🧮 Algorithms in Browser Home Page Hub

This document details the core mathematical and computational algorithms implemented across the project. Every algorithm is explained using the **5 W's and 1 H framework** (**What, Why, Where, When, Who, How**) to provide clear, practical understanding.

---

## 📑 Table of Contents

1. [PBKDF2 Key Derivation Algorithm](#1-pbkdf2-key-derivation-algorithm)
2. [AES-256-GCM Authenticated Encryption & Decryption](#2-aes-256-gcm-authenticated-encryption--decryption)
3. [HMAC-SHA256 Zero-Knowledge Verification Hash](#3-hmac-sha256-zero-knowledge-verification-hash)
4. [Windows DPAPI & Chromium Master Key Decryption](#4-windows-dpapi--chromium-master-key-decryption)
5. [Password Strength & Entropy Scoring Algorithm](#5-password-strength--entropy-scoring-algorithm)
6. [Debounce Algorithm for Real-Time State Sync](#6-debounce-algorithm-for-real-time-state-sync)
7. [Weighted Multi-Factor Ranking & Sorting Algorithm](#7-weighted-multi-factor-ranking--sorting-algorithm)

---

## 1. PBKDF2 Key Derivation Algorithm

### 🔍 5 W's and 1 H Overview
* **What:** Password-Based Key Derivation Function 2 (PBKDF2) using HMAC-SHA512 with 100,000 iterations to derive a fixed 256-bit (32-byte) cryptographic key from a variable-length user master password.
* **Why:** Plain passwords lack uniform length and randomness, and are vulnerable to dictionary/brute-force attacks. PBKDF2 introduces computational work ("key stretching") and a cryptographic salt to make offline attacks infeasible.
* **Where:** `server.js` (`deriveVaultKey(masterPassword, saltHex)` function).
* **When:** Executed whenever:
  1. The user initializes the vault (`POST /api/passwords/vault/setup`).
  2. The user unlocks the vault (`POST /api/passwords/vault/unlock`).
  3. The user updates the master password (`POST /api/passwords/vault/change-password`).
* **Who:** The Node.js backend server, on behalf of the authenticated user.
* **How:**
  1. The function takes the user's master password string and a 16-byte cryptographically random salt (stored in hexadecimal).
  2. It invokes Node.js native `crypto.pbkdf2Sync()`:
     ```javascript
     function deriveVaultKey(masterPassword, saltHex) {
       const salt = Buffer.from(saltHex, "hex");
       return crypto.pbkdf2Sync(masterPassword, salt, 100000, 32, "sha512");
     }
     ```
  3. Iterates 100,000 times through the HMAC-SHA512 pseudo-random function.
  4. Yields a 32-byte raw binary buffer used directly as the symmetric key for AES-256-GCM.

---

## 2. AES-256-GCM Authenticated Encryption & Decryption

### 🔍 5 W's and 1 H Overview
* **What:** Advanced Encryption Standard in Galois/Counter Mode with a 256-bit key (AES-256-GCM). It provides both confidentiality (encryption) and integrity/authenticity (MAC authentication tag).
* **Why:** Simple symmetric encryption (like AES-CBC) is susceptible to bit-flipping and padding oracle attacks. GCM mode produces a 16-byte authentication tag verifying that the encrypted ciphertext has not been tampered with.
* **Where:** `server.js` (`encryptWithVaultKey(plaintext, key)` and `decryptWithVaultKey(encryptedPayload, key)`).
* **When:**
  - **Encryption:** When new passwords are saved (`POST /api/passwords`), imported (`POST /api/passwords/import`), synced from browsers, or re-encrypted during master password changes.
  - **Decryption:** When serving passwords to an unlocked client (`GET /api/passwords`), or during export and master password updates.
* **Who:** The backend crypto layer protecting user credentials in `data/storage.json`.
* **How:**
  1. **Initialization Vector (IV):** For each encryption operation, a fresh, non-repeating 12-byte random IV is generated via `crypto.randomBytes(12)`.
  2. **Cipher Creation:** An AES-256-GCM cipher is initialized with the derived 32-byte key and the 12-byte IV.
  3. **Encryption & Tagging:** Plaintext is encrypted, and `cipher.getAuthTag()` outputs a 16-byte tag.
  4. **Payload Serialization:** The components are concatenated using colon delimiters:
     $$\text{Payload} = \text{"enc:"} \parallel \text{iv}_{\text{hex}} \parallel \text{":"} \parallel \text{tag}_{\text{hex}} \parallel \text{":"} \parallel \text{ciphertext}_{\text{hex}}$$
  5. **Decryption Verification:** Upon reading, the string is parsed. If the decipher fails or the authentication tag mismatch occurs, an error is thrown, preventing corrupted or manipulated data from being read.

---

## 3. HMAC-SHA256 Zero-Knowledge Verification Hash

### 🔍 5 W's and 1 H Overview
* **What:** Hash-based Message Authentication Code using SHA-256 (HMAC-SHA256) evaluated over a fixed challenge string (`"vault-verifier-v1"`).
* **Why:** Allows the server to verify whether an entered master password is correct without storing the master password or its direct hash on disk.
* **Where:** `server.js` (`computeVaultCheck(key)`).
* **When:**
  - Created during initial vault setup and master password changes.
  - Evaluated on each unlock attempt to return instant `401 Unauthorized` without risking partial decryption.
* **Who:** Backend authentication handler.
* **How:**
  1. The server takes the derived 32-byte AES key (which is in RAM only).
  2. It computes:
     $$\text{testHash} = \text{HMAC-SHA256}(\text{key}, \text{"vault-verifier-v1"})$$
  3. The resulting hex digest is persisted in `storage.json` under `vault.testHash`.
  4. When the user unlocks, the server derives the trial key and compares its HMAC with `state.vault.testHash`. Because HMAC is a one-way function, possession of `testHash` reveals zero information about the key or password.

---

## 4. Windows DPAPI & Chromium Master Key Decryption

### 🔍 5 W's and 1 H Overview
* **What:** Windows Data Protection API (`CryptUnprotectData`) algorithm combined with AES-256-GCM payload extraction for reading Chromium browser passwords (Chrome, Edge, Brave).
* **Why:** Chromium-based browsers on Windows protect user passwords in SQLite databases (`Login Data`) by encrypting them with an AES-256-GCM key that is itself encrypted using the logged-in Windows user's credentials via DPAPI.
* **Where:** `password-scanner.js` (`decryptChromiumMasterKey()`, `decryptV10Password()`).
* **When:** During background password scanning (`POST /api/passwords/sync` or manual browser profile sync).
* **Who:** Background password scanner daemon running locally on the user's PC.
* **How:**
  1. **Read `Local State`:** Extracts `os_crypt.encrypted_key` (Base64 string).
  2. **Strip DPAPI Prefix:** Removes the first 5 bytes (ASCII `"DPAPI"` prefix).
  3. **Call DPAPI:** Invokes Windows `CryptUnprotectData` via inline PowerShell/C# interop using the user's active session token:
     ```powershell
     [System.Security.Cryptography.ProtectedData]::Unprotect($cipherBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
     ```
  4. **Decrypt Password:** Each password in SQLite begins with `v10` or `v11` (3 bytes), followed by a 12-byte IV, the ciphertext, and a 16-byte GCM tag. The scanner splits these slices and decrypts the credential using Node.js `crypto.createDecipheriv('aes-256-gcm')`.

---

## 5. Password Strength & Entropy Scoring Algorithm

### 🔍 5 W's and 1 H Overview
* **What:** Heuristic multi-criteria strength scoring algorithm evaluating password length, character diversity, and dictionary patterns.
* **Why:** Provides users with instant visual feedback (Strong / Medium / Weak / Empty) to encourage security hygiene across their saved credentials.
* **Where:** `public/js/passwords.js` (`analyzeStrength(pwd)`).
* **When:** Evaluated in real-time on keystroke inside modal inputs, and during dashboard table/grid rendering.
* **Who:** Frontend user interface.
* **How:**
  1. If `!pwd || pwd.trim() === ''`, immediately returns `{ score: 0, pct: 0, label: 'Empty', level: 'empty' }`.
  2. Calculates base score points:
     - $+1$ if length $\ge 8$ characters
     - $+1$ if length $\ge 12$ characters
     - $+1$ if length $\ge 16$ characters
     - $+1$ if contains lowercase (`/[a-z]/`)
     - $+1$ if contains uppercase (`/[A-Z]/`)
     - $+1$ if contains numbers (`/[0-9]/`)
     - $+1$ if contains special symbols (`/[^a-zA-Z0-9]/`)
  3. Evaluates penalties:
     - $-1$ if entire string is all letters or all digits.
  4. Maps final score:
     - $\text{score} \ge 6$: **Strong** (Green `#10b981`)
     - $\text{score} \ge 4$: **Medium** (Amber `#f59e0b`)
     - $\text{score} < 4$: **Weak** (Red `#ef4444`)

---

## 6. Debounce Algorithm for Real-Time State Sync

### 🔍 5 W's and 1 H Overview
* **What:** Higher-order function that delays invoking a state-persistence function until a specified idle duration has elapsed since the last call.
* **Why:** Prevents flooding the backend with HTTP PUT requests on every single keystroke in sticky notes, search inputs, or settings sliders.
* **Where:** `public/js/app.js` (`debounce(fn, delay)`), `public/js/passwords.js`, and `public/js/bookmarks.js`.
* **When:** Fires on text input events in note cards, search query fields, and live forms.
* **Who:** Frontend event dispatch system.
* **How:**
  ```javascript
  function debounce(func, delay = 400) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }
  ```
  1. Clears any pending timer whenever a new keystroke occurs within the 400ms window.
  2. Sets a new timer for 400ms.
  3. Only executes the network payload when the user pauses typing, cutting network overhead by up to $95\%$.

---

## 7. Weighted Multi-Factor Ranking & Sorting Algorithm

### 🔍 5 W's and 1 H Overview
* **What:** Compound comparator algorithm sorting bookmarks, sites, and passwords across multiple categorical attributes (pinned state, visit counts, update timestamps, and lexical order).
* **Why:** High-frequency shortcuts must always remain easily reachable without manual layout restructuring.
* **Where:**
  - Speed Dial sites: `public/js/app.js` (`renderSites()`).
  - Bookmarks sorting: `public/js/bookmarks.js` (`getFilteredAndSorted()`).
  - Passwords sorting: `public/js/passwords.js` (`getFilteredAndSorted()`).
* **When:** Executed whenever a site is visited, items are filtered, or sort criteria change.
* **Who:** Frontend presentation layer.
* **How:**
  For Speed Dial sites:
  1. **Primary Weight (Pinned):** Pinned items ($p.\text{pinned} = \text{true}$) always sort before unpinned items ($b.\text{pinned} - a.\text{pinned}$).
  2. **Secondary Weight (Visits):** If both have identical pin status and sorting is set to `visits`, items sort in descending order of visit frequency ($b.\text{visits} - a.\text{visits}$).
  3. **Tertiary Weight (Creation):** Ties break by latest creation timestamp ($b.\text{createdAt} - a.\text{createdAt}$).
