/**
 * password-scanner.js
 *
 * Auto-scans Chromium-based browser credential stores (Chrome, Edge, Brave)
 * across all profiles and imports saved logins into the app state.
 *
 * Windows DPAPI decryption is performed via standard Python ctypes,
 * and AES-256-GCM is decrypted using Node.js built-in crypto.
 *
 * Zero external npm packages required.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// ── Browser definitions ─────────────────────────────────────────────────────

const BROWSERS = [
  { name: 'Chrome',  userDataDir: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data') },
  { name: 'Edge',    userDataDir: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data') },
  { name: 'Brave',   userDataDir: path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data') },
];

const SKIP_PROFILES = new Set(['Guest Profile', 'System Profile']);

/**
 * Read and parse a JSON file, returning null on any error.
 */
function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

/**
 * Discover profiles and their display names from `Local State`.
 * Returns an array of { dirName, displayName }.
 */
function discoverProfiles(userDataDir) {
  const localState = readJsonSafe(path.join(userDataDir, 'Local State'));
  if (!localState) return [];

  const infoCache = localState?.profile?.info_cache;
  if (!infoCache || typeof infoCache !== 'object') {
    // Fallback: check if 'Default' folder exists
    if (fs.existsSync(path.join(userDataDir, 'Default'))) {
      return [{ dirName: 'Default', displayName: 'Default' }];
    }
    return [];
  }

  const profiles = [];
  for (const [dirName, info] of Object.entries(infoCache)) {
    if (SKIP_PROFILES.has(dirName)) continue;
    profiles.push({
      dirName,
      displayName: (info && info.name) || dirName,
    });
  }
  return profiles;
}

/**
 * Unprotect Chromium DPAPI master key from Local State.
 */
function getMasterKey(userDataDir) {
  const localStatePath = path.join(userDataDir, 'Local State');
  if (!fs.existsSync(localStatePath)) return null;

  try {
    const localState = readJsonSafe(localStatePath);
    const encKeyBase64 = localState?.os_crypt?.encrypted_key;
    if (!encKeyBase64) return null;

    const encKeyBuf = Buffer.from(encKeyBase64, 'base64');
    // Strip leading 'DPAPI' signature (5 bytes)
    const toDecrypt = encKeyBuf.subarray(5);

    const pyScript = `
import sys, ctypes, ctypes.wintypes
class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", ctypes.wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]
data = sys.stdin.buffer.read()
bin = DATA_BLOB(len(data), ctypes.cast(ctypes.create_string_buffer(data), ctypes.POINTER(ctypes.c_char)))
bout = DATA_BLOB()
if ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(bin), None, None, None, None, 0, ctypes.byref(bout)):
    dec = ctypes.string_at(bout.pbData, bout.cbData)
    ctypes.windll.kernel32.LocalFree(bout.pbData)
    sys.stdout.buffer.write(dec)
`;
    const masterKey = execFileSync('python', ['-c', pyScript], {
      input: toDecrypt,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return masterKey && masterKey.length === 32 ? masterKey : null;
  } catch (_err) {
    return null;
  }
}

/**
 * Decrypt a Chromium password buffer using AES-256-GCM.
 */
function decryptPassword(encryptedVal, masterKey) {
  if (!encryptedVal || !Buffer.isBuffer(encryptedVal) || encryptedVal.length < 31 || !masterKey) {
    return '';
  }

  const prefix = encryptedVal.subarray(0, 3).toString('utf8');
  if (prefix === 'v10' || prefix === 'v20') {
    const iv = encryptedVal.subarray(3, 15);
    const ciphertext = encryptedVal.subarray(15, encryptedVal.length - 16);
    const tag = encryptedVal.subarray(encryptedVal.length - 16);

    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (_err) {
      return '';
    }
  }
  return '';
}

/**
 * Read logins from a SQLite Login Data file (safely copying to temp first).
 */
function readLoginsFromDb(loginDataPath) {
  if (!fs.existsSync(loginDataPath)) return [];

  const tempDb = path.join(os.tmpdir(), `logins_temp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.db`);
  try {
    fs.copyFileSync(loginDataPath, tempDb);

    const pyScript = `
import sys, sqlite3, json, base64
conn = sqlite3.connect(sys.argv[1])
cursor = conn.cursor()
cursor.execute("SELECT origin_url, action_url, username_value, password_value, date_created FROM logins")
rows = []
for r in cursor.fetchall():
    rows.append({
        "origin_url": r[0] or "",
        "action_url": r[1] or "",
        "username_value": r[2] or "",
        "password_value_b64": base64.b64encode(r[3]).decode("utf-8") if r[3] else "",
        "date_created": r[4] or 0
    })
conn.close()
print(json.dumps(rows))
`;
    const output = execFileSync('python', ['-c', pyScript, tempDb], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return JSON.parse(output.toString('utf8'));
  } catch (_err) {
    return [];
  } finally {
    try {
      if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);
    } catch (_) {}
  }
}

/**
 * Derive a user-friendly title from a URL.
 */
function deriveTitle(url) {
  if (!url) return 'Saved Login';
  try {
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    const host = parsed.hostname.replace(/^www\./, '');
    const parts = host.split('.');
    if (parts.length >= 2) {
      const domainName = parts[parts.length - 2];
      return domainName.charAt(0).toUpperCase() + domainName.slice(1);
    }
    return host;
  } catch {
    return (url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'Saved Login';
  }
}

/**
 * Guess category based on domain / url.
 */
function guessCategory(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('google') || u.includes('gmail') || u.includes('outlook') || u.includes('yahoo') || u.includes('mail')) return 'Email';
  if (u.includes('github') || u.includes('gitlab') || u.includes('bitbucket') || u.includes('stackoverflow') || u.includes('vercel') || u.includes('aws')) return 'Developer';
  if (u.includes('bank') || u.includes('chase') || u.includes('paypal') || u.includes('stripe') || u.includes('pay') || u.includes('wallet')) return 'Banking';
  if (u.includes('amazon') || u.includes('ebay') || u.includes('walmart') || u.includes('flipkart') || u.includes('shop')) return 'Shopping';
  if (u.includes('netflix') || u.includes('youtube') || u.includes('spotify') || u.includes('disney') || u.includes('hulu') || u.includes('twitch')) return 'Entertainment';
  if (u.includes('facebook') || u.includes('twitter') || u.includes('x.com') || u.includes('instagram') || u.includes('linkedin') || u.includes('reddit')) return 'Social';
  if (u.includes('lpu') || u.includes('edu') || u.includes('school') || u.includes('coursera') || u.includes('udemy')) return 'Education';
  return 'General';
}

/**
 * Convert Chromium timestamp to ms.
 */
function chromiumTimeToJs(dateCreated) {
  if (!dateCreated) return Date.now();
  const raw = (parseInt(dateCreated, 10) - 11644473600000000) / 1000;
  return raw > 0 ? raw : Date.now();
}

// ── Scanner factory ─────────────────────────────────────────────────────────

function createPasswordScanner(options) {
  const { getState, saveState, broadcast, intervalMs = 60000 } = options;
  let timer = null;

  function scan() {
    try {
      const state = getState();
      if (!state) return { addedCount: 0, totalCount: 0 };
      if (!Array.isArray(state.passwords)) state.passwords = [];

      const existingKeys = new Set();
      for (const p of state.passwords) {
        if (p.sourceKey) existingKeys.add(p.sourceKey);
      }

      let addedCount = 0;

      for (const browser of BROWSERS) {
        let dirExists = false;
        try {
          dirExists = fs.statSync(browser.userDataDir).isDirectory();
        } catch (_e) {}
        if (!dirExists) continue;

        const masterKey = getMasterKey(browser.userDataDir);
        const profiles = discoverProfiles(browser.userDataDir);

        for (const profile of profiles) {
          const loginDataFile = path.join(browser.userDataDir, profile.dirName, 'Login Data');
          if (!fs.existsSync(loginDataFile)) continue;

          const logins = readLoginsFromDb(loginDataFile);

          for (const item of logins) {
            const url = item.origin_url || item.action_url || '';
            const username = item.username_value || '';
            const rawPwdBuf = item.password_value_b64 ? Buffer.from(item.password_value_b64, 'base64') : null;
            const decryptedPwd = masterKey ? decryptPassword(rawPwdBuf, masterKey) : '';

            // Skip entries without url AND without username
            if (!url && !username) continue;

            const sourceKey = `${browser.name}|${profile.displayName}|${url}|${username}`;
            if (existingKeys.has(sourceKey)) continue;

            const title = deriveTitle(url);
            const category = guessCategory(url);
            const created = chromiumTimeToJs(item.date_created);

            const newEntry = {
              id: 'pw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
              title,
              url,
              username,
              password: decryptedPwd,
              category,
              group: `${browser.name} — ${profile.displayName}`,
              browserSource: browser.name,
              profileName: profile.displayName,
              sourceKey,
              autoImported: true,
              starred: false,
              notes: '',
              tags: [browser.name],
              createdAt: created,
              updatedAt: created,
            };

            state.passwords.push(newEntry);
            existingKeys.add(sourceKey);
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        console.log(`[password-scanner] Imported ${addedCount} new password(s) across browser profiles.`);
        try { saveState(); } catch (err) {
          console.error('[password-scanner] Failed to save state:', err.message);
        }
        try { broadcast('passwords_updated', { passwords: state.passwords }); } catch (err) {
          console.error('[password-scanner] Failed to broadcast:', err.message);
        }
      }

      return { addedCount, totalCount: state.passwords.length };
    } catch (err) {
      console.error('[password-scanner] Scan error:', err.message);
      return { addedCount: 0, totalCount: (getState()?.passwords || []).length };
    }
  }

  function start() {
    console.log(`[password-scanner] Starting (interval: ${intervalMs}ms)`);
    scan();
    timer = setInterval(scan, intervalMs);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      console.log('[password-scanner] Stopped.');
    }
  }

  return { start, stop, scan };
}

module.exports = { createPasswordScanner };
