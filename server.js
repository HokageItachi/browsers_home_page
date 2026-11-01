const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_PORT = process.env.PORT || 48173;
const DEFAULT_DATA_FILE = path.join(__dirname, "data", "storage.json");
const DEFAULT_PUBLIC_DIR = path.join(__dirname, "public");

// MIME types for static assets
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

// Factory function to create app instance (enables modular testing & isolated storage)
function createApp(options = {}) {
  const dataFile = options.dataFile || DEFAULT_DATA_FILE;
  const publicDir = options.publicDir || DEFAULT_PUBLIC_DIR;
  const configuredPort = options.port !== undefined ? options.port : DEFAULT_PORT;

  let state = null;
  const sseClients = new Set();
  let saveTimeout = null;
  let heartbeatInterval = null;
  let passwordScanner = null;
  let activeVaultKey = null;

  function deriveVaultKey(masterPassword, saltHex) {
    const salt = Buffer.from(saltHex, 'hex');
    return crypto.pbkdf2Sync(String(masterPassword), salt, 100000, 32, 'sha256');
  }

  function computeVaultCheck(key) {
    return crypto.createHmac('sha256', key).update('vault_auth_token_check_v1').digest('hex');
  }

  function encryptWithVaultKey(plainText, key) {
    if (!plainText) return '';
    if (typeof plainText === 'string' && plainText.startsWith('enc:aes256:')) return plainText;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:aes256:${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  }

  function decryptWithVaultKey(encryptedStr, key) {
    if (!encryptedStr || typeof encryptedStr !== 'string') return '';
    if (!encryptedStr.startsWith('enc:aes256:')) return encryptedStr;
    const parts = encryptedStr.split(':');
    if (parts.length !== 5) return '';
    const [, , ivHex, tagHex, cipherHex] = parts;
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const ciphertext = Buffer.from(cipherHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (_e) {
      return '';
    }
  }

  try {
    const { createPasswordScanner } = require('./password-scanner');
    passwordScanner = createPasswordScanner({
      getState: () => state,
      saveState: saveStateSync,
      broadcast: (type, payload, origId) => broadcast(type, payload, origId),
      encryptPassword: (pwd) => (activeVaultKey ? encryptWithVaultKey(pwd, activeVaultKey) : pwd),
      intervalMs: 60000,
    });
  } catch (_e) {}

  // Load state from disk
  function loadState() {
    try {
      if (fs.existsSync(dataFile)) {
        const raw = fs.readFileSync(dataFile, "utf-8");
        state = JSON.parse(raw);
        if (!Array.isArray(state.passwords)) state.passwords = [];
        if (!Array.isArray(state.bookmarks)) state.bookmarks = [];
        if (!state.vault) state.vault = { isConfigured: false, salt: null, testHash: null };
      } else {
        state = {
          settings: {
            theme: "dark",
            userName: "Explorer",
            activeSearchEngine: "google",
            sortByVisits: true,
          },
          sites: [],
          todos: [],
          notes: [],
          bookmarks: [],
          passwords: [],
          vault: { isConfigured: false, salt: null, testHash: null },
        };
        saveStateSync();
      }
    } catch (err) {
      console.error("Error loading state:", err);
      state = { settings: {}, sites: [], todos: [], notes: [], bookmarks: [], passwords: [], vault: { isConfigured: false, salt: null, testHash: null } };
    }
  }

  function saveStateSync() {
    try {
      const dir = path.dirname(dataFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(state, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to write storage file synchronously:", err);
    }
  }

  // Debounced state save to disk
  function saveState() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveStateSync();
    }, 100);
  }

  // Broadcast SSE event to all connected browsers
  function broadcast(eventType, payload, originClientId = null) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify({ ...payload, originClientId })}\n\n`;
    for (const client of sseClients) {
      try {
        client.res.write(message);
      } catch (err) {
        sseClients.delete(client);
      }
    }
  }

  // Helper to parse JSON body from incoming requests
  function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 5 * 1024 * 1024) {
          reject(new Error("Request entity too large"));
        }
      });
      req.on("end", () => {
        if (!body) return resolve({});
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error("Invalid JSON"));
        }
      });
      req.on("error", reject);
    });
  }

  // Helper to send JSON responses
  function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(data));
  }

  // Request dispatcher
  const server = http.createServer(async (req, res) => {
    // Enable CORS
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Client-ID",
      });
      return res.end();
    }

    const clientId = req.headers["x-client-id"] || null;
    const parsedUrl = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`,
    );
    const pathname = parsedUrl.pathname;

    // Real-time Server-Sent Events stream
    if (pathname === "/api/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(":connected\n\n");

      const clientRef = { res, id: clientId };
      sseClients.add(clientRef);

      // Send current state immediately on connect
      res.write(`event: init\ndata: ${JSON.stringify(state)}\n\n`);

      req.on("close", () => {
        sseClients.delete(clientRef);
      });
      return;
    }

    // REST API Endpoints
    if (pathname.startsWith("/api/")) {
      try {
        // GET full state
        if (pathname === "/api/state" && req.method === "GET") {
          return sendJSON(res, 200, state);
        }

        // Settings
        if (pathname === "/api/settings" && req.method === "PUT") {
          const body = await parseRequestBody(req);
          state.settings = { ...state.settings, ...body };
          saveState();
          broadcast("settings_updated", { settings: state.settings }, clientId);
          return sendJSON(res, 200, state.settings);
        }

        // Sites - Add
        if (pathname === "/api/sites" && req.method === "POST") {
          const body = await parseRequestBody(req);
          const newSite = {
            id:
              "site-" +
              Date.now() +
              "-" +
              Math.random().toString(36).substr(2, 4),
            title: body.title || "Untitled",
            url: body.url.startsWith("http") ? body.url : `https://${body.url}`,
            visits: body.visits || 1,
            pinned: !!body.pinned,
          };
          state.sites.push(newSite);
          saveState();
          broadcast("sites_updated", { sites: state.sites }, clientId);
          return sendJSON(res, 201, newSite);
        }

        // Sites - Increment Visit
        const siteVisitMatch = pathname.match(/^\/api\/sites\/([^/]+)\/visit$/);
        if (siteVisitMatch && req.method === "POST") {
          const siteId = siteVisitMatch[1];
          const site = state.sites.find((s) => s.id === siteId);
          if (site) {
            site.visits = (site.visits || 0) + 1;
            saveState();
            broadcast("sites_updated", { sites: state.sites }, clientId);
            return sendJSON(res, 200, site);
          }
          return sendJSON(res, 404, { error: "Site not found" });
        }

        // Sites - Update
        const siteMatch = pathname.match(/^\/api\/sites\/([^/]+)$/);
        if (siteMatch && req.method === "PUT") {
          const siteId = siteMatch[1];
          const body = await parseRequestBody(req);
          const index = state.sites.findIndex((s) => s.id === siteId);
          if (index !== -1) {
            state.sites[index] = { ...state.sites[index], ...body, id: siteId };
            saveState();
            broadcast("sites_updated", { sites: state.sites }, clientId);
            return sendJSON(res, 200, state.sites[index]);
          }
          return sendJSON(res, 404, { error: "Site not found" });
        }

        // Sites - Delete
        if (siteMatch && req.method === "DELETE") {
          const siteId = siteMatch[1];
          state.sites = state.sites.filter((s) => s.id !== siteId);
          saveState();
          broadcast("sites_updated", { sites: state.sites }, clientId);
          return sendJSON(res, 200, { success: true });
        }

        // Todos - Add
        if (pathname === "/api/todos" && req.method === "POST") {
          const body = await parseRequestBody(req);
          const newTodo = {
            id:
              "todo-" +
              Date.now() +
              "-" +
              Math.random().toString(36).substr(2, 4),
            text: (body.text || "").trim(),
            completed: false,
            createdAt: Date.now(),
          };
          state.todos.unshift(newTodo);
          saveState();
          broadcast("todos_updated", { todos: state.todos }, clientId);
          return sendJSON(res, 201, newTodo);
        }

        // Todos - Update
        const todoMatch = pathname.match(/^\/api\/todos\/([^/]+)$/);
        if (todoMatch && req.method === "PUT") {
          const todoId = todoMatch[1];
          const body = await parseRequestBody(req);
          const index = state.todos.findIndex((t) => t.id === todoId);
          if (index !== -1) {
            state.todos[index] = { ...state.todos[index], ...body, id: todoId };
            saveState();
            broadcast("todos_updated", { todos: state.todos }, clientId);
            return sendJSON(res, 200, state.todos[index]);
          }
          return sendJSON(res, 404, { error: "Todo not found" });
        }

        // Todos - Delete
        if (todoMatch && req.method === "DELETE") {
          const todoId = todoMatch[1];
          state.todos = state.todos.filter((t) => t.id !== todoId);
          saveState();
          broadcast("todos_updated", { todos: state.todos }, clientId);
          return sendJSON(res, 200, { success: true });
        }

        // Notes - Add
        if (pathname === "/api/notes" && req.method === "POST") {
          const body = await parseRequestBody(req);
          const newNote = {
            id:
              "note-" +
              Date.now() +
              "-" +
              Math.random().toString(36).substr(2, 4),
            title: (body.title || "Untitled Note").trim(),
            content: body.content || "",
            color: body.color || "yellow",
            updatedAt: Date.now(),
          };
          state.notes.push(newNote);
          saveState();
          broadcast("notes_updated", { notes: state.notes }, clientId);
          return sendJSON(res, 201, newNote);
        }

        // Notes - Update
        const noteMatch = pathname.match(/^\/api\/notes\/([^/]+)$/);
        if (noteMatch && req.method === "PUT") {
          const noteId = noteMatch[1];
          const body = await parseRequestBody(req);
          const index = state.notes.findIndex((n) => n.id === noteId);
          if (index !== -1) {
            state.notes[index] = {
              ...state.notes[index],
              ...body,
              id: noteId,
              updatedAt: Date.now(),
            };
            saveState();
            broadcast("notes_updated", { notes: state.notes }, clientId);
            return sendJSON(res, 200, state.notes[index]);
          }
          return sendJSON(res, 404, { error: "Note not found" });
        }

        // Notes - Delete
        if (noteMatch && req.method === "DELETE") {
          const noteId = noteMatch[1];
          state.notes = state.notes.filter((n) => n.id !== noteId);
          saveState();
          broadcast("notes_updated", { notes: state.notes }, clientId);
          return sendJSON(res, 200, { success: true });
        }

        // Bookmarks - Get All
        if (pathname === "/api/bookmarks" && req.method === "GET") {
          if (!state.bookmarks) state.bookmarks = [];
          return sendJSON(res, 200, state.bookmarks);
        }

        // Bookmarks - Groups Rename (must be before individual bookmark match)
        if (
          pathname === "/api/bookmarks/groups/rename" &&
          req.method === "PUT"
        ) {
          if (!state.bookmarks) state.bookmarks = [];
          const body = await parseRequestBody(req);
          const { oldName, newName } = body;
          if (!oldName || !newName) {
            return sendJSON(res, 400, {
              error: "oldName and newName are required",
            });
          }
          state.bookmarks.forEach((bm) => {
            if (bm.group === oldName) bm.group = newName;
          });
          saveState();
          broadcast(
            "bookmarks_updated",
            { bookmarks: state.bookmarks },
            clientId,
          );
          return sendJSON(res, 200, { success: true });
        }

        // Bookmarks - Groups Delete (must be before individual bookmark match)
        const groupDeleteMatch = pathname.match(
          /^\/api\/bookmarks\/groups\/(.+)$/,
        );
        if (groupDeleteMatch && req.method === "DELETE") {
          if (!state.bookmarks) state.bookmarks = [];
          const groupName = decodeURIComponent(groupDeleteMatch[1]);
          state.bookmarks = state.bookmarks.filter(
            (bm) => bm.group !== groupName,
          );
          saveState();
          broadcast(
            "bookmarks_updated",
            { bookmarks: state.bookmarks },
            clientId,
          );
          return sendJSON(res, 200, { success: true });
        }

        // Bookmarks - Add
        if (pathname === "/api/bookmarks" && req.method === "POST") {
          if (!state.bookmarks) state.bookmarks = [];
          const body = await parseRequestBody(req);
          const newBookmark = {
            id:
              "bm-" +
              Date.now() +
              "-" +
              Math.random().toString(36).substr(2, 4),
            title: body.title || "Untitled",
            url: body.url || "",
            favicon: body.favicon || "",
            group: body.group || "Default",
            createdAt: Date.now(),
          };
          state.bookmarks.push(newBookmark);
          saveState();
          broadcast(
            "bookmarks_updated",
            { bookmarks: state.bookmarks },
            clientId,
          );
          return sendJSON(res, 201, newBookmark);
        }

        // Bookmarks - Update / Delete by ID
        const bookmarkMatch = pathname.match(/^\/api\/bookmarks\/([^/]+)$/);
        if (bookmarkMatch && req.method === "PUT") {
          if (!state.bookmarks) state.bookmarks = [];
          const bmId = bookmarkMatch[1];
          const body = await parseRequestBody(req);
          const index = state.bookmarks.findIndex((bm) => bm.id === bmId);
          if (index !== -1) {
            state.bookmarks[index] = {
              ...state.bookmarks[index],
              ...body,
              id: bmId,
            };
            saveState();
            broadcast(
              "bookmarks_updated",
              { bookmarks: state.bookmarks },
              clientId,
            );
            return sendJSON(res, 200, state.bookmarks[index]);
          }
          return sendJSON(res, 404, { error: "Bookmark not found" });
        }

        if (bookmarkMatch && req.method === "DELETE") {
          if (!state.bookmarks) state.bookmarks = [];
          const bmId = bookmarkMatch[1];
          state.bookmarks = state.bookmarks.filter((bm) => bm.id !== bmId);
          saveState();
          broadcast(
            "bookmarks_updated",
            { bookmarks: state.bookmarks },
            clientId,
          );
          return sendJSON(res, 200, { success: true });
        }

        // Vault - Status
        if (pathname === "/api/passwords/vault/status" && req.method === "GET") {
          const isConfigured = !!(state.vault && state.vault.isConfigured);
          const isUnlocked = !isConfigured || !!activeVaultKey;
          return sendJSON(res, 200, {
            isConfigured,
            isUnlocked: isConfigured ? isUnlocked : true,
          });
        }

        // Vault - Setup Master Password
        if (pathname === "/api/passwords/vault/setup" && req.method === "POST") {
          const body = await parseRequestBody(req);
          const masterPassword = (body.masterPassword || "").trim();
          if (!masterPassword || masterPassword.length < 6) {
            return sendJSON(res, 400, { error: "Master password must be at least 6 characters" });
          }

          const salt = crypto.randomBytes(16);
          const saltHex = salt.toString("hex");
          const key = deriveVaultKey(masterPassword, saltHex);
          const testHash = computeVaultCheck(key);

          state.vault = {
            isConfigured: true,
            salt: saltHex,
            testHash: testHash,
            updatedAt: Date.now(),
          };

          // Encrypt all existing passwords in state
          if (Array.isArray(state.passwords)) {
            for (const p of state.passwords) {
              if (p.password && !p.password.startsWith("enc:aes256:")) {
                p.password = encryptWithVaultKey(p.password, key);
              }
            }
          }

          activeVaultKey = key;
          saveState();
          broadcast("vault_updated", { isConfigured: true, isUnlocked: true }, clientId);
          broadcast("passwords_updated", { passwords: state.passwords }, clientId);
          return sendJSON(res, 200, { success: true, isConfigured: true, isUnlocked: true });
        }

        // Vault - Unlock
        if (pathname === "/api/passwords/vault/unlock" && req.method === "POST") {
          const body = await parseRequestBody(req);
          const masterPassword = (body.masterPassword || "").trim();
          if (!state.vault || !state.vault.isConfigured) {
            return sendJSON(res, 400, { error: "Vault is not configured yet" });
          }

          const key = deriveVaultKey(masterPassword, state.vault.salt);
          const testHash = computeVaultCheck(key);
          if (testHash !== state.vault.testHash) {
            return sendJSON(res, 401, { error: "Incorrect Master Password" });
          }

          activeVaultKey = key;
          broadcast("vault_updated", { isConfigured: true, isUnlocked: true }, clientId);
          return sendJSON(res, 200, { success: true, isUnlocked: true });
        }

        // Vault - Lock
        if (pathname === "/api/passwords/vault/lock" && req.method === "POST") {
          activeVaultKey = null;
          broadcast("vault_updated", { isConfigured: !!(state.vault && state.vault.isConfigured), isUnlocked: false }, clientId);
          return sendJSON(res, 200, { success: true, isUnlocked: false });
        }

        // Vault - Change Master Password
        if (pathname === "/api/passwords/vault/change-password" && req.method === "POST") {
          if (!state.vault || !state.vault.isConfigured) {
            return sendJSON(res, 400, { error: "Vault is not configured yet" });
          }
          const body = await parseRequestBody(req);
          const currentPassword = (body.currentMasterPassword || "").trim();
          const newPassword = (body.newMasterPassword || "").trim();

          if (!currentPassword) {
            return sendJSON(res, 400, { error: "Current master password is required" });
          }
          if (!newPassword || newPassword.length < 6) {
            return sendJSON(res, 400, { error: "New master password must be at least 6 characters" });
          }

          // Verify current password
          const oldKey = deriveVaultKey(currentPassword, state.vault.salt);
          const testHash = computeVaultCheck(oldKey);
          if (testHash !== state.vault.testHash) {
            return sendJSON(res, 401, { error: "Current master password is incorrect" });
          }

          // Generate new salt and derive new key
          const newSalt = crypto.randomBytes(16);
          const newSaltHex = newSalt.toString("hex");
          const newKey = deriveVaultKey(newPassword, newSaltHex);
          const newTestHash = computeVaultCheck(newKey);

          // Re-encrypt all existing passwords with new key
          if (Array.isArray(state.passwords)) {
            for (const p of state.passwords) {
              if (p.password) {
                const plain = decryptWithVaultKey(p.password, oldKey);
                p.password = encryptWithVaultKey(plain, newKey);
              }
            }
          }

          state.vault = {
            isConfigured: true,
            salt: newSaltHex,
            testHash: newTestHash,
            updatedAt: Date.now(),
          };

          activeVaultKey = newKey;
          saveState();
          broadcast("vault_updated", { isConfigured: true, isUnlocked: true }, clientId);
          return sendJSON(res, 200, { success: true, message: "Master password changed successfully" });
        }

        // Passwords - Get All
        if (pathname === "/api/passwords" && req.method === "GET") {
          if (!state.passwords) state.passwords = [];
          const isConfigured = !!(state.vault && state.vault.isConfigured);
          const isUnlocked = !isConfigured || !!activeVaultKey;

          const list = state.passwords.map((pw) => {
            let plainPwd = "";
            if (!isConfigured) {
              plainPwd = pw.password || "";
            } else if (isUnlocked && activeVaultKey) {
              plainPwd = decryptWithVaultKey(pw.password, activeVaultKey);
            } else {
              plainPwd = "";
            }
            return {
              ...pw,
              password: plainPwd,
              isLocked: isConfigured && !isUnlocked,
            };
          });
          return sendJSON(res, 200, list);
        }

        // Passwords - Sync from Browser Profiles on Demand
        if (pathname === "/api/passwords/sync" && req.method === "POST") {
          if (!state.passwords) state.passwords = [];
          let result = { addedCount: 0, totalCount: state.passwords.length };
          if (passwordScanner) {
            result = passwordScanner.scan();
          }
          return sendJSON(res, 200, { success: true, ...result });
        }

        // Passwords - Import from JSON or CSV
        if (pathname === "/api/passwords/import" && req.method === "POST") {
          if (!state.passwords) state.passwords = [];
          const isConfigured = !!(state.vault && state.vault.isConfigured);
          if (isConfigured && !activeVaultKey) {
            return sendJSON(res, 403, { error: "Vault is locked. Unlock vault to import passwords." });
          }

          const body = await parseRequestBody(req);
          const items = Array.isArray(body) ? body : (body.passwords || []);
          let count = 0;

          function normUrl(u) {
            return (u || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
          }

          for (const item of items) {
            const itemUrl = item.url || '';
            const itemUser = (item.username || item.login || '').trim();
            let rawPwd = item.password || '';
            const itemTitle = item.title || item.name || '';

            if (!itemTitle && !itemUrl && !itemUser) continue;

            const storedPwd = (activeVaultKey && rawPwd) ? encryptWithVaultKey(rawPwd, activeVaultKey) : rawPwd;
            const nUrl = normUrl(itemUrl);
            const existing = nUrl ? state.passwords.find(p => normUrl(p.url) === nUrl && (p.username || '').trim().toLowerCase() === itemUser.toLowerCase()) : null;

            if (existing) {
              if (rawPwd) existing.password = storedPwd;
              if (itemTitle && (!existing.title || existing.title === 'Saved Login' || existing.title === 'Untitled')) {
                existing.title = itemTitle;
              }
              if (item.notes) existing.notes = item.notes;
              if (item.category && (!existing.category || existing.category === 'General')) {
                existing.category = item.category;
              }
              existing.updatedAt = Date.now();
              count++;
            } else {
              const newEntry = {
                id: "pw-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
                title: itemTitle || "Untitled",
                url: itemUrl,
                username: itemUser,
                password: storedPwd,
                category: item.category || "General",
                notes: item.notes || "",
                tags: Array.isArray(item.tags) ? item.tags : (item.browser ? [item.browser] : []),
                starred: !!item.starred,
                browserSource: item.browserSource || item.browser || "Imported",
                createdAt: item.createdAt || Date.now(),
                updatedAt: item.updatedAt || Date.now(),
              };
              state.passwords.unshift(newEntry);
              count++;
            }
          }
          saveState();
          broadcast("passwords_updated", { passwords: state.passwords }, clientId);
          return sendJSON(res, 200, { success: true, importedCount: count, totalCount: state.passwords.length });
        }

        // Passwords - Categories Rename
        if (
          pathname === "/api/passwords/categories/rename" &&
          req.method === "PUT"
        ) {
          if (!state.passwords) state.passwords = [];
          const body = await parseRequestBody(req);
          const { oldName, newName } = body;
          if (!oldName || !newName) {
            return sendJSON(res, 400, {
              error: "oldName and newName are required",
            });
          }
          state.passwords.forEach((pw) => {
            if ((pw.category || "General") === oldName) pw.category = newName;
          });
          saveState();
          broadcast(
            "passwords_updated",
            { passwords: state.passwords },
            clientId,
          );
          return sendJSON(res, 200, { success: true });
        }

        // Passwords - Categories Delete
        const catDeleteMatch = pathname.match(
          /^\/api\/passwords\/categories\/(.+)$/,
        );
        if (catDeleteMatch && req.method === "DELETE") {
          if (!state.passwords) state.passwords = [];
          const catName = decodeURIComponent(catDeleteMatch[1]);
          state.passwords = state.passwords.filter(
            (pw) => (pw.category || "General") !== catName,
          );
          saveState();
          broadcast(
            "passwords_updated",
            { passwords: state.passwords },
            clientId,
          );
          return sendJSON(res, 200, { success: true });
        }

        // Passwords - Add
        if (pathname === "/api/passwords" && req.method === "POST") {
          if (!state.passwords) state.passwords = [];
          const isConfigured = !!(state.vault && state.vault.isConfigured);
          if (isConfigured && !activeVaultKey) {
            return sendJSON(res, 403, { error: "Vault is locked. Unlock vault to add passwords." });
          }

          const body = await parseRequestBody(req);
          const rawPwd = body.password || "";
          const storedPwd = (activeVaultKey && rawPwd) ? encryptWithVaultKey(rawPwd, activeVaultKey) : rawPwd;

          const newEntry = {
            id:
              "pw-" +
              Date.now() +
              "-" +
              Math.random().toString(36).substr(2, 4),
            title: body.title || "Untitled",
            url: body.url || "",
            username: body.username || "",
            password: storedPwd,
            category: body.category || "General",
            notes: body.notes || "",
            tags: Array.isArray(body.tags) ? body.tags : [],
            starred: !!body.starred,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          state.passwords.unshift(newEntry);
          saveState();
          broadcast(
            "passwords_updated",
            { passwords: state.passwords },
            clientId,
          );
          return sendJSON(res, 201, { ...newEntry, password: rawPwd });
        }

        // Passwords - Update / Delete by ID
        const passwordMatch = pathname.match(/^\/api\/passwords\/([^/]+)$/);
        if (passwordMatch && req.method === "PUT") {
          if (!state.passwords) state.passwords = [];
          const isConfigured = !!(state.vault && state.vault.isConfigured);
          if (isConfigured && !activeVaultKey) {
            return sendJSON(res, 403, { error: "Vault is locked. Unlock vault to update passwords." });
          }

          const pwId = passwordMatch[1];
          const body = await parseRequestBody(req);
          const index = state.passwords.findIndex((p) => p.id === pwId);
          if (index !== -1) {
            const updated = { ...state.passwords[index], ...body, id: pwId, updatedAt: Date.now() };
            if (body.password !== undefined) {
              updated.password = (activeVaultKey && body.password) ? encryptWithVaultKey(body.password, activeVaultKey) : body.password;
            }
            state.passwords[index] = updated;
            saveState();
            broadcast(
              "passwords_updated",
              { passwords: state.passwords },
              clientId,
            );
            return sendJSON(res, 200, { ...updated, password: body.password !== undefined ? body.password : (activeVaultKey ? decryptWithVaultKey(updated.password, activeVaultKey) : updated.password) });
          }
          return sendJSON(res, 404, { error: "Password not found" });
        }

        if (passwordMatch && req.method === "DELETE") {
          if (!state.passwords) state.passwords = [];
          const pwId = passwordMatch[1];
          state.passwords = state.passwords.filter((p) => p.id !== pwId);
          saveState();
          broadcast(
            "passwords_updated",
            { passwords: state.passwords },
            clientId,
          );
          return sendJSON(res, 200, { success: true });
        }

        return sendJSON(res, 404, { error: "API route not found" });
      } catch (err) {
        console.error("API Error:", err);
        return sendJSON(res, 500, { error: err.message });
      }
    }

    // Static File Serving
    let relativePath = pathname === "/" ? "index.html" : pathname;
    const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(publicDir, safePath);

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        const indexPath = path.join(publicDir, "index.html");
        if (fs.existsSync(indexPath)) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          fs.createReadStream(indexPath).pipe(res);
        } else {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
        }
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath).pipe(res);
    });
  });

  // Start helper
  function start() {
    return new Promise((resolve, reject) => {
      loadState();

      heartbeatInterval = setInterval(() => {
        for (const client of sseClients) {
          try {
            client.res.write(":ping\n\n");
          } catch (err) {
            sseClients.delete(client);
          }
        }
      }, 25000);

      server.on("error", (err) => {
        if (err.code === "EACCES") {
          console.error(
            `\n❌ Error: Port ${configuredPort} is restricted by Windows TCP Exclusion Range.`,
          );
          console.error(
            `   Windows Hyper-V/NAT reserves port ranges between 49152 and 49351.`,
          );
          console.error(
            `   Recommended alternative ports: 48173, 41973, or 38173.\n`,
          );
        } else if (err.code === "EADDRINUSE") {
          console.error(
            `\n❌ Error: Port ${configuredPort} is already in use by another application.\n`,
          );
        } else {
          console.error(`Server error:`, err);
        }
        reject(err);
      });

      server.listen(configuredPort, () => {
        const actualPort = server.address().port;
        resolve({ server, port: actualPort, state });
      });
    });
  }

  // Stop helper
  function stop() {
    return new Promise((resolve) => {
      if (passwordScanner) passwordScanner.stop();
      clearInterval(heartbeatInterval);
      clearTimeout(saveTimeout);
      saveStateSync();
      for (const client of sseClients) {
        try {
          client.res.end();
        } catch (e) {}
      }
      sseClients.clear();
      server.close(() => resolve());
    });
  }

  return {
    server,
    start,
    stop,
    getState: () => state,
    saveStateSync,
    broadcast,
    sseClients,
    passwordScanner,
  };
}

// If executed directly from CLI
if (require.main === module) {
  const { createBookmarkScanner } = require('./bookmark-scanner');
  const app = createApp();
  app.start().then(({ port }) => {
    console.log(`=======================================================`);
    console.log(`  🌐 Multi-Browser Synchronized Home Page is running!  `);
    console.log(`  🔗 Open URL: http://localhost:${port}                 `);
    console.log(`  ⚡ Real-Time SSE Sync active across all browsers     `);
    console.log(`  🔖 Bookmark auto-import scanning every 30 seconds    `);
    console.log(`  🔐 Password auto-import scanning every 60 seconds    `);
    console.log(`=======================================================`);

    // Start bookmark auto-scanner
    const scanner = createBookmarkScanner({
      getState: app.getState,
      saveState: app.saveStateSync,
      broadcast: app.broadcast,
      intervalMs: 30000,
    });
    scanner.start();

    // Start password auto-scanner
    if (app.passwordScanner) {
      app.passwordScanner.start();
    }

    // Graceful shutdown
    process.on('SIGINT', async () => {
      scanner.stop();
      if (app.passwordScanner) app.passwordScanner.stop();
      await app.stop();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      scanner.stop();
      if (app.passwordScanner) app.passwordScanner.stop();
      await app.stop();
      process.exit(0);
    });
  }).catch(() => {
    process.exit(1);
  });
}

module.exports = { createApp };
