/**
 * bookmark-scanner.js
 *
 * Auto-scans Chromium-based browser bookmark files (Chrome, Edge, Brave)
 * and imports new bookmarks into the app state.
 *
 * Usage:
 *   const { createBookmarkScanner } = require('./bookmark-scanner');
 *   const scanner = createBookmarkScanner({ getState, saveState, broadcast });
 *   scanner.start();
 *   // later…
 *   scanner.stop();
 */

const fs = require('fs');
const path = require('path');

// ── Browser definitions ─────────────────────────────────────────────────────

const BROWSERS = [
  { name: 'Chrome',  userDataDir: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data') },
  { name: 'Edge',    userDataDir: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data') },
  { name: 'Brave',   userDataDir: path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data') },
];

const SKIP_PROFILES = new Set(['Guest Profile', 'System Profile']);

const ROOTS_KEYS = ['bookmark_bar', 'other', 'synced'];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a Chromium FILETIME string (microseconds since 1601-01-01)
 * to a JS timestamp (milliseconds since 1970-01-01).
 */
function chromiumTimeToJs(dateAddedStr) {
  if (!dateAddedStr) return 0;
  const raw = (parseInt(dateAddedStr, 10) - 11644473600000000) / 1000;
  return raw > 0 ? raw : 0;
}

/**
 * Read and parse a JSON file, returning null on any error.
 */
function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (_err) {
    // File missing, locked, or malformed — skip silently
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
  if (!infoCache || typeof infoCache !== 'object') return [];

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
 * Human-readable root-key labels for the folder path.
 */
const ROOT_LABELS = {
  bookmark_bar: 'Bookmark Bar',
  other: 'Other Bookmarks',
  synced: 'Synced Bookmarks',
};

/**
 * Recursively walk a Chromium bookmark node tree, collecting url entries.
 * Each collected entry gets { title, url, dateAdded, folderPath }.
 */
function walkBookmarkNode(node, folderSegments, results) {
  if (!node) return;

  if (node.type === 'url' && node.url) {
    results.push({
      title: node.name || '',
      url: node.url,
      dateAdded: chromiumTimeToJs(node.date_added),
      folderPath: folderSegments.join(' > '),
    });
  } else if (node.type === 'folder' && Array.isArray(node.children)) {
    const nextSegments = node.name
      ? [...folderSegments, node.name]
      : folderSegments;
    for (const child of node.children) {
      walkBookmarkNode(child, nextSegments, results);
    }
  }
}

// ── Scanner factory ─────────────────────────────────────────────────────────

/**
 * Create a bookmark scanner.
 *
 * @param {Object}   options
 * @param {Function} options.getState    — returns the app state object
 * @param {Function} options.saveState   — persists state to disk
 * @param {Function} options.broadcast   — broadcast(eventType, payload, clientId?)
 * @param {number}   [options.intervalMs=30000] — scan interval in ms
 * @returns {{ start: Function, stop: Function }}
 */
function createBookmarkScanner(options) {
  const { getState, saveState, broadcast, intervalMs = 30000 } = options;
  let timer = null;

  /**
   * Run a single scan across all browsers / profiles.
   */
  function scan() {
    try {
      const state = getState();
      if (!state || !Array.isArray(state.bookmarks)) return;

      // Build a Set of existing sourceKeys for fast dedup lookups
      const existingKeys = new Set();
      for (const bm of state.bookmarks) {
        if (bm.sourceKey) existingKeys.add(bm.sourceKey);
      }

      let addedCount = 0;

      for (const browser of BROWSERS) {
        // Check if the User Data directory exists at all
        let dirExists = false;
        try {
          dirExists = fs.statSync(browser.userDataDir).isDirectory();
        } catch (_e) { /* skip browser */ }
        if (!dirExists) continue;

        const profiles = discoverProfiles(browser.userDataDir);

        for (const profile of profiles) {
          const bookmarksFile = path.join(
            browser.userDataDir,
            profile.dirName,
            'Bookmarks'
          );

          const data = readJsonSafe(bookmarksFile);
          if (!data || !data.roots) continue;

          // Collect all url nodes from each root
          const collected = [];
          for (const rootKey of ROOTS_KEYS) {
            const rootNode = data.roots[rootKey];
            if (!rootNode) continue;
            const label = ROOT_LABELS[rootKey] || rootKey;
            // The root node itself is a folder; start the path with its label
            if (rootNode.type === 'folder' && Array.isArray(rootNode.children)) {
              for (const child of rootNode.children) {
                walkBookmarkNode(child, [label], collected);
              }
            }
          }

          // Merge new bookmarks into state
          for (const entry of collected) {
            const sourceKey = `${browser.name}|${profile.displayName}|${entry.url}`;

            if (existingKeys.has(sourceKey)) continue;

            const newBookmark = {
              id: 'bm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
              title: entry.title,
              url: entry.url,
              group: `${browser.name} — ${profile.displayName}`,
              folder: entry.folderPath,
              sourceKey,
              browserSource: browser.name,
              profileName: profile.displayName,
              autoImported: true,
              createdAt: entry.dateAdded || Date.now(),
            };

            state.bookmarks.push(newBookmark);
            existingKeys.add(sourceKey);
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        console.log(`[bookmark-scanner] Imported ${addedCount} new bookmark(s).`);
        try { saveState(); } catch (err) {
          console.error('[bookmark-scanner] Failed to save state:', err.message);
        }
        try { broadcast('bookmarks_updated', { bookmarks: state.bookmarks }); } catch (err) {
          console.error('[bookmark-scanner] Failed to broadcast:', err.message);
        }
      }
    } catch (err) {
      console.error('[bookmark-scanner] Scan error:', err.message);
    }
  }

  /**
   * Start the scanner: run an initial scan immediately, then on an interval.
   */
  function start() {
    console.log(`[bookmark-scanner] Starting (interval: ${intervalMs}ms)`);
    scan();
    timer = setInterval(scan, intervalMs);
  }

  /**
   * Stop the scanner.
   */
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      console.log('[bookmark-scanner] Stopped.');
    }
  }

  return { start, stop };
}

module.exports = { createBookmarkScanner };
