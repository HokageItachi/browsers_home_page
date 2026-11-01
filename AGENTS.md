# AGENTS.md — Primary Rules & Instructions for AI Coding Assistants

This repository contains personal dashboard software with bookmarks, to-dos, notes, and a personal password vault.
Any AI agent, assistant, or subagent working in this codebase **MUST strictly adhere to the following rules at all times**.

---

## 🔒 1. Confidentiality & Sensitive Data Protection

1. **Never Expose or Dump User Credentials**:
   - `data/storage.json`, `data/storage.local.json`, and any file in `data/` may contain real user credentials and private notes.
   - **NEVER** dump the contents of passwords or credentials into chat responses, logs, scratch files, or test outputs.
   - When inspecting data for debugging, only check structure, counts, or keys (e.g., `passwords.length`, boolean flags). Never log `password_value` or decrypted plaintext credentials.

2. **Strict Git / GitHub Restrictions**:
   - **NEVER** stage, commit, or push `data/storage.json`, `data/storage.local.json`, `.env`, or any `.key` file to Git / GitHub.
   - Ensure `data/storage.json` remains permanently listed in `.gitignore`.
   - Never remove security exclusions from `.gitignore`.
   - Only `data/storage.example.json` (a clean template without personal data) is allowed in Git tracking.

3. **Secret Key & Master Password Protection**:
   - Any cryptographic keys, salt, or user master passwords must remain local-only.
   - Never hardcode or leak decryption keys or master passwords in commits, public files, or conversation summaries.

---

## 🛠️ 2. Architectural Guidelines & Coding Standards

1. **Zero External NPM Packages**:
   - This project strictly uses Node.js standard built-in modules (`http`, `fs`, `path`, `crypto`, `os`, `child_process`).
   - Do NOT introduce npm dependencies or heavy third-party packages unless explicitly requested by the user.

2. **Master Password & AES-256-GCM Storage Encryption**:
   - Passwords stored in `data/storage.json` must always be stored in encrypted format (`enc:...`) using AES-256-GCM derived from the user's Master Password (PBKDF2).
   - Plaintext passwords must NEVER be saved directly to disk.
   - Vault state must support Lock and Unlock mechanisms.

3. **Isolated Testing**:
   - All tests in `tests/` must use isolated temporary files or in-memory fixtures.
   - Tests must **NEVER** read, overwrite, or mutate production `data/storage.json`.
   - All existing test suites (`npm test`) must pass without errors after any code modification.

4. **Multi-Page Navigation Consistency**:
   - Maintain the unified navigation header across all 3 pages (`/`, `/bookmarks.html`, `/passwords.html`):
     - `[🏠 Home]`
     - `[🔖 Bookmarks]`
     - `[🔑 Passwords]`
   - The active page must be visually highlighted with an active pill style.

---

## ⚠️ 3. Prohibited Actions for Agents

- ❌ Do NOT run commands that print raw password fields to stdout.
- ❌ Do NOT remove the `--cached` untracking of `data/storage.json`.
- ❌ Do NOT force-push or bypass branch rules on GitHub.
- ❌ Do NOT overwrite user notes, bookmarks, or passwords without explicit consent.
