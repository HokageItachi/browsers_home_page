/**
 * Bookmarks Library — Client-Side Controller
 * Modern, Professional bookmark manager with auto-imported browser profiles,
 * sorting, 3 view modes (Grid, List, Compact), quick actions, and toast alerts.
 */

const CLIENT_ID = 'client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

let bookmarks = [];
let activeGroup = null; // null = "All", or "__browser__:Chrome", or specific group name
let activeBrowserFilter = null; // null = All, or "Chrome", "Edge", "Brave"
let searchQuery = '';
let currentView = 'grid'; // 'grid' | 'list' | 'compact'
let currentSort = 'newest'; // 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'domain'
let toastTimeout = null;

// Browser brand icons (Clean crisp SVGs matching official branding)
const BROWSER_ICONS = {
  Chrome: `<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#4285F4"/><circle cx="12" cy="12" r="4.5" fill="#fff"/><path d="M12 7.5A4.5 4.5 0 0 0 8.2 10L3.5 10A10 10 0 0 1 12 2a10 10 0 0 1 8.5 4.7L16.8 13A4.5 4.5 0 0 0 12 7.5z" fill="#EA4335"/><path d="M16.8 13a4.5 4.5 0 0 1-8.6-1H3.5A10 10 0 0 0 12 22a10 10 0 0 0 4.3-1L12 13.5a4.5 4.5 0 0 0 4.8-.5z" fill="#34A853"/><path d="M16.3 6.7L12 13.5a4.5 4.5 0 0 0 4.8-.5l3.7 6.5A10 10 0 0 0 22 12a10 10 0 0 0-1.5-5.3z" fill="#FBBC05"/></svg>`,
  Edge: `<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#0078D4"/><path d="M7 15.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5c0 2.2-2 4-5 4s-5-1.8-5-4z" fill="#50E6FF"/><path d="M6.5 10c0-3 2.5-5.5 5.5-5.5 2.3 0 4.2 1.4 5 3.4-.8-1.2-2.5-2-4.5-2C9 5.9 6.5 7.8 6.5 10z" fill="#fff"/></svg>`,
  Brave: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" fill="#FB542B"/><path d="M12 5l5 3v4c0 3.5-2.2 6.8-5 7.9-2.8-1.1-5-4.4-5-7.9V8l5-3z" fill="#fff"/></svg>`,
};

// DOM references
let bmSearch, bmSearchClear, bookmarksGrid, bmEmpty, bmEmptyText, totalCount, emptyAddBtn;
let groupList, activeGroupTitle, activeResultsCount, groupActions, renameGroupBtn, deleteGroupBtn;
let browserChips, bmSortSelect, bmToast;
let bookmarkModal, bmForm, bmModalTitle, bmFormId, bmFormTitle, bmFormUrl, bmFormGroup;
let closeBmModal, cancelBmModal, deleteBmBtn, bmNewGroupInline;
let renameModal, renameForm, renameInput, closeRenameModal, cancelRenameModal;
let addBookmarkBtn, addGroupBtn, themeToggleBtn;

function initDOMElements() {
  bmSearch = document.getElementById('bmSearch');
  bmSearchClear = document.getElementById('bmSearchClear');
  bookmarksGrid = document.getElementById('bookmarksGrid');
  bmEmpty = document.getElementById('bmEmpty');
  bmEmptyText = document.getElementById('bmEmptyText');
  totalCount = document.getElementById('totalCount');
  emptyAddBtn = document.getElementById('emptyAddBtn');
  groupList = document.getElementById('groupList');
  activeGroupTitle = document.getElementById('activeGroupTitle');
  activeResultsCount = document.getElementById('activeResultsCount');
  groupActions = document.getElementById('groupActions');
  renameGroupBtn = document.getElementById('renameGroupBtn');
  deleteGroupBtn = document.getElementById('deleteGroupBtn');
  browserChips = document.getElementById('browserChips');
  bmSortSelect = document.getElementById('bmSortSelect');
  bmToast = document.getElementById('bmToast');

  bookmarkModal = document.getElementById('bookmarkModal');
  bmForm = document.getElementById('bmForm');
  bmModalTitle = document.getElementById('bmModalTitle');
  bmFormId = document.getElementById('bmFormId');
  bmFormTitle = document.getElementById('bmFormTitle');
  bmFormUrl = document.getElementById('bmFormUrl');
  bmFormGroup = document.getElementById('bmFormGroup');
  closeBmModal = document.getElementById('closeBmModal');
  cancelBmModal = document.getElementById('cancelBmModal');
  deleteBmBtn = document.getElementById('deleteBmBtn');
  bmNewGroupInline = document.getElementById('bmNewGroupInline');

  renameModal = document.getElementById('renameModal');
  renameForm = document.getElementById('renameForm');
  renameInput = document.getElementById('renameInput');
  closeRenameModal = document.getElementById('closeRenameModal');
  cancelRenameModal = document.getElementById('cancelRenameModal');

  addBookmarkBtn = document.getElementById('addBookmarkBtn');
  addGroupBtn = document.getElementById('addGroupBtn');
  themeToggleBtn = document.getElementById('themeToggleBtn');
}

/* ========== API Calls ========== */

async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-ID': CLIENT_ID
    }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(endpoint, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ========== SSE Real-Time Sync ========== */

function setupSSE() {
  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('init', (e) => {
    try {
      const data = JSON.parse(e.data);
      bookmarks = data.bookmarks || [];
      applyTheme(data.settings?.theme || 'dark');
      renderAll();
    } catch (err) { console.error(err); }
  });

  evtSource.addEventListener('bookmarks_updated', (e) => {
    try {
      const { bookmarks: updated } = JSON.parse(e.data);
      bookmarks = updated || [];
      renderAll();
    } catch (err) { console.error(err); }
  });

  evtSource.addEventListener('settings_updated', (e) => {
    try {
      const { settings } = JSON.parse(e.data);
      applyTheme(settings?.theme || 'dark');
    } catch (err) { console.error(err); }
  });
}

/* ========== Theme Management ========== */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  apiRequest('/api/settings', 'PUT', { theme: next });
}

/* ========== Notification Toast ========== */

function showToast(message) {
  if (!bmToast) return;
  bmToast.textContent = message;
  bmToast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    bmToast.classList.remove('show');
  }, 2400);
}

/* ========== Helpers ========== */

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return (url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'link';
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 0) return 'Just now';

  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getGroups() {
  const groups = {};
  bookmarks.forEach(bm => {
    const g = bm.group || 'Ungrouped';
    groups[g] = (groups[g] || 0) + 1;
  });
  return groups;
}

function getBrowserSources() {
  const sources = {};
  bookmarks.forEach(bm => {
    if (bm.browserSource) {
      sources[bm.browserSource] = (sources[bm.browserSource] || 0) + 1;
    }
  });
  return sources;
}

/* ========== Filtering & Sorting ========== */

function getFilteredAndSortedBookmarks() {
  let list = [...bookmarks];

  // 1. Group / Browser navigation filter
  if (activeGroup) {
    if (activeGroup.startsWith('__browser__:')) {
      const browser = activeGroup.replace('__browser__:', '');
      list = list.filter(bm => bm.browserSource === browser);
    } else {
      list = list.filter(bm => (bm.group || 'Ungrouped') === activeGroup);
    }
  }

  // 2. Browser quick chips filter (if active)
  if (activeBrowserFilter) {
    list = list.filter(bm => bm.browserSource === activeBrowserFilter);
  }

  // 3. Search query filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(bm =>
      (bm.title || '').toLowerCase().includes(q) ||
      (bm.url || '').toLowerCase().includes(q) ||
      (bm.group || '').toLowerCase().includes(q) ||
      (bm.folder || '').toLowerCase().includes(q) ||
      (bm.profileName || '').toLowerCase().includes(q)
    );
  }

  // 4. Sorting
  list.sort((a, b) => {
    if (currentSort === 'newest') {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }
    if (currentSort === 'oldest') {
      return (a.createdAt || 0) - (b.createdAt || 0);
    }
    if (currentSort === 'title_asc') {
      return (a.title || '').localeCompare(b.title || '');
    }
    if (currentSort === 'title_desc') {
      return (b.title || '').localeCompare(a.title || '');
    }
    if (currentSort === 'domain') {
      return getDomain(a.url).localeCompare(getDomain(b.url));
    }
    return 0;
  });

  return list;
}

/* ========== Render Sidebar Groups ========== */

function renderGroups() {
  if (!groupList) return;
  const groups = getGroups();
  const browsers = getBrowserSources();
  const groupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  const browserGroups = [];
  const manualGroups = [];
  groupNames.forEach(name => {
    if (/^(Chrome|Edge|Brave)\s*—\s*/.test(name)) {
      browserGroups.push(name);
    } else {
      manualGroups.push(name);
    }
  });

  groupList.innerHTML = '';

  // Quick Views
  appendGroupItem(groupList, {
    label: 'All Bookmarks',
    count: bookmarks.length,
    icon: `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
    isActive: activeGroup === null && activeBrowserFilter === null,
    onClick: () => {
      activeGroup = null;
      activeBrowserFilter = null;
      renderAll();
    }
  });

  // Browser sections
  if (Object.keys(browsers).length > 0) {
    const divider = document.createElement('div');
    divider.className = 'bm-sidebar-divider';
    divider.innerHTML = '<span>Browsers</span>';
    groupList.appendChild(divider);

    Object.keys(browsers).sort().forEach(browser => {
      appendGroupItem(groupList, {
        label: browser,
        count: browsers[browser],
        icon: BROWSER_ICONS[browser] || '',
        isActive: activeGroup === `__browser__:${browser}`,
        onClick: () => {
          activeGroup = `__browser__:${browser}`;
          activeBrowserFilter = null;
          renderAll();
        }
      });
    });
  }

  // Profile sections
  if (browserGroups.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'bm-sidebar-divider';
    divider.innerHTML = '<span>Profiles</span>';
    groupList.appendChild(divider);

    browserGroups.forEach(name => {
      const match = name.match(/^(Chrome|Edge|Brave)\s*—\s*(.+)$/);
      const browserName = match ? match[1] : '';
      const profileLabel = match ? match[2] : name;

      appendGroupItem(groupList, {
        label: profileLabel,
        count: groups[name],
        icon: BROWSER_ICONS[browserName] || `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
        isActive: activeGroup === name,
        onClick: () => {
          activeGroup = name;
          activeBrowserFilter = null;
          renderAll();
        }
      });
    });
  }

  // Custom Collections
  if (manualGroups.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'bm-sidebar-divider';
    divider.innerHTML = '<span>Custom Collections</span>';
    groupList.appendChild(divider);

    manualGroups.forEach(name => {
      appendGroupItem(groupList, {
        label: name,
        count: groups[name],
        icon: `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
        isActive: activeGroup === name,
        onClick: () => {
          activeGroup = name;
          activeBrowserFilter = null;
          renderAll();
        }
      });
    });
  }
}

function appendGroupItem(parent, { label, count, icon, isActive, onClick }) {
  const btn = document.createElement('button');
  btn.className = `bm-group-item ${isActive ? 'active' : ''}`;
  btn.title = label;
  btn.innerHTML = `
    <span class="bm-group-item-icon">${icon}</span>
    <span class="bm-group-item-label">${escapeHtml(label)}</span>
    <span class="bm-group-item-count">${count}</span>
  `;
  btn.addEventListener('click', onClick);
  parent.appendChild(btn);
}

/* ========== Render Quick Browser Chips ========== */

function renderBrowserChips() {
  if (!browserChips) return;
  const browsers = getBrowserSources();
  const keys = Object.keys(browsers).sort();

  if (keys.length === 0) {
    browserChips.innerHTML = '';
    return;
  }

  browserChips.innerHTML = '';

  // All chip
  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = `bm-browser-chip ${activeBrowserFilter === null ? 'active' : ''}`;
  allChip.innerHTML = `<span>All</span>`;
  allChip.addEventListener('click', () => {
    activeBrowserFilter = null;
    renderBookmarks();
    renderBrowserChips();
  });
  browserChips.appendChild(allChip);

  // Each browser chip
  keys.forEach(b => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `bm-browser-chip ${activeBrowserFilter === b ? 'active' : ''}`;
    chip.innerHTML = `${BROWSER_ICONS[b] || ''} <span>${b}</span>`;
    chip.addEventListener('click', () => {
      activeBrowserFilter = activeBrowserFilter === b ? null : b;
      renderBookmarks();
      renderBrowserChips();
    });
    browserChips.appendChild(chip);
  });
}

/* ========== Render Bookmarks Cards / Rows ========== */

function renderBookmarks() {
  if (!bookmarksGrid || !bmEmpty || !totalCount) return;

  const filtered = getFilteredAndSortedBookmarks();

  // Update total counts & header
  totalCount.textContent = `${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''}`;
  if (activeResultsCount) {
    activeResultsCount.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
  }

  // Update active breadcrumb title
  if (activeGroupTitle) {
    if (activeGroup === null) {
      activeGroupTitle.textContent = activeBrowserFilter ? `${activeBrowserFilter} Bookmarks` : 'All Bookmarks';
    } else if (activeGroup.startsWith('__browser__:')) {
      activeGroupTitle.textContent = activeGroup.replace('__browser__:', '') + ' Bookmarks';
    } else {
      activeGroupTitle.textContent = activeGroup;
    }
  }

  // Show group actions (rename/delete) only for custom user groups
  if (groupActions) {
    const isCustom = activeGroup && !activeGroup.startsWith('__browser__:') && !/^(Chrome|Edge|Brave)\s*—\s*/.test(activeGroup);
    groupActions.style.display = isCustom ? 'flex' : 'none';
  }

  // Set container view class
  bookmarksGrid.className = `bm-grid view-${currentView}`;

  // Handle empty state
  if (filtered.length === 0) {
    bookmarksGrid.style.display = 'none';
    bmEmpty.style.display = 'flex';
    if (bmEmptyText) {
      bmEmptyText.textContent = searchQuery
        ? `No bookmarks matching "${searchQuery}". Press Esc to clear search.`
        : 'No bookmarks found in this collection.';
    }
    return;
  }

  bmEmpty.style.display = 'none';
  bookmarksGrid.style.display = '';
  bookmarksGrid.innerHTML = '';

  // Render appropriate view mode
  if (currentView === 'grid') {
    renderGridView(filtered);
  } else if (currentView === 'list') {
    renderListView(filtered);
  } else if (currentView === 'compact') {
    renderCompactView(filtered);
  }
}

/* ========== View 1: Grid View Renderer ========== */

function renderGridView(items) {
  items.forEach(bm => {
    const domain = getDomain(bm.url);
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    const initial = (bm.title || domain || 'B')[0].toUpperCase();
    const relativeTime = formatRelativeTime(bm.createdAt);

    const card = document.createElement('div');
    card.className = 'bm-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');

    const sourceBadge = getSourceBadgeHtml(bm);
    const folderBadge = getFolderBadgeHtml(bm);

    card.innerHTML = `
      <div class="bm-card-top">
        <div class="bm-card-favicon">
          <img src="${faviconUrl}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <span class="bm-fallback" style="display:none;">${initial}</span>
        </div>
        <div class="bm-card-info">
          <div class="bm-card-title" title="${escapeHtml(bm.title)}">${escapeHtml(bm.title || domain)}</div>
          <a href="${escapeHtml(bm.url)}" class="bm-card-domain" target="_blank" rel="noopener noreferrer" title="${escapeHtml(bm.url)}">
            <span>${escapeHtml(domain)}</span>
            <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </div>

      <div class="bm-card-meta">
        ${sourceBadge}
        ${folderBadge}
      </div>

      <div class="bm-card-bottom">
        <span class="bm-card-date">${relativeTime ? relativeTime : ''}</span>
        <div class="bm-card-actions">
          ${getActionsHtml()}
        </div>
      </div>
    `;

    attachRowEventHandlers(card, bm);
    bookmarksGrid.appendChild(card);
  });
}

/* ========== View 2: Detailed List View Renderer ========== */

function renderListView(items) {
  // Sticky Multi-Column Table Header
  const header = document.createElement('div');
  header.className = 'bm-list-header';
  header.innerHTML = `
    <div class="th-main">Bookmark & Domain</div>
    <div class="th-source">Browser / Profile</div>
    <div class="th-folder">Folder Path</div>
    <div class="th-date">Added</div>
    <div class="th-actions">Actions</div>
  `;
  bookmarksGrid.appendChild(header);

  items.forEach(bm => {
    const domain = getDomain(bm.url);
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    const initial = (bm.title || domain || 'B')[0].toUpperCase();
    const relativeTime = formatRelativeTime(bm.createdAt);

    const row = document.createElement('div');
    row.className = 'bm-list-row';
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'link');

    row.innerHTML = `
      <div class="col-main">
        <div class="bm-list-favicon">
          <img src="${faviconUrl}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <span class="bm-fallback" style="display:none;">${initial}</span>
        </div>
        <div class="bm-list-info">
          <div class="bm-list-title" title="${escapeHtml(bm.title)}">${escapeHtml(bm.title || domain)}</div>
          <a href="${escapeHtml(bm.url)}" class="bm-list-domain" target="_blank" rel="noopener noreferrer" title="${escapeHtml(bm.url)}">
            <span>${escapeHtml(domain)}</span>
            <svg viewBox="0 0 24 24" width="9" height="9" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      </div>

      <div class="col-source">
        ${getSourceBadgeHtml(bm)}
      </div>

      <div class="col-folder">
        ${getFolderBadgeHtml(bm)}
      </div>

      <div class="col-date">${relativeTime ? relativeTime : '—'}</div>

      <div class="col-actions">
        ${getActionsHtml()}
      </div>
    `;

    attachRowEventHandlers(row, bm);
    bookmarksGrid.appendChild(row);
  });
}

/* ========== View 3: Compact View Renderer ========== */

function renderCompactView(items) {
  // Sticky Compact Header
  const header = document.createElement('div');
  header.className = 'bm-compact-header';
  header.innerHTML = `
    <div class="th-icon"></div>
    <div class="th-main">Title</div>
    <div class="th-domain">Domain</div>
    <div class="th-source">Source & Profile</div>
    <div class="th-actions">Actions</div>
  `;
  bookmarksGrid.appendChild(header);

  items.forEach(bm => {
    const domain = getDomain(bm.url);
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    const initial = (bm.title || domain || 'B')[0].toUpperCase();

    const row = document.createElement('div');
    row.className = 'bm-compact-row';
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'link');

    row.innerHTML = `
      <div class="col-icon">
        <img src="${faviconUrl}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
        <span class="bm-fallback" style="display:none; font-size:0.75rem; font-weight:700; color:var(--primary);">${initial}</span>
      </div>

      <div class="col-title" title="${escapeHtml(bm.title)}">${escapeHtml(bm.title || domain)}</div>

      <div class="col-domain" title="${escapeHtml(bm.url)}">${escapeHtml(domain)}</div>

      <div class="col-source">
        ${getSourceBadgeHtml(bm)}
      </div>

      <div class="col-actions">
        ${getActionsHtml()}
      </div>
    `;

    attachRowEventHandlers(row, bm);
    bookmarksGrid.appendChild(row);
  });
}

/* ========== Shared Template Helpers ========== */

function getSourceBadgeHtml(bm) {
  if (bm.browserSource) {
    const bIcon = BROWSER_ICONS[bm.browserSource] || '';
    const pName = bm.profileName ? escapeHtml(bm.profileName) : bm.browserSource;
    return `
      <span class="bm-card-browser-badge" title="Imported from ${escapeHtml(bm.browserSource)} (${pName})">
        ${bIcon}
        <span>${pName}</span>
      </span>
    `;
  }
  return `
    <span class="bm-card-browser-badge" title="Custom collection">
      <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
      <span>${escapeHtml(bm.group || 'Default')}</span>
    </span>
  `;
}

function getFolderBadgeHtml(bm) {
  if (bm.folder) {
    return `
      <span class="bm-card-folder-path" title="${escapeHtml(bm.folder)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${escapeHtml(bm.folder)}</span>
      </span>
    `;
  } else if (bm.group && !/^(Chrome|Edge|Brave)\s*—\s*/.test(bm.group)) {
    return `
      <span class="bm-card-folder-path" title="${escapeHtml(bm.group)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>${escapeHtml(bm.group)}</span>
      </span>
    `;
  }
  return `<span class="bm-card-folder-path empty-folder">—</span>`;
}

function getActionsHtml() {
  return `
    <button type="button" class="bm-card-action-btn copy-btn" title="Copy Link to Clipboard">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
    <button type="button" class="bm-card-action-btn edit-btn" title="Edit Bookmark">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    </button>
    <button type="button" class="bm-card-action-btn delete-btn" title="Delete Bookmark">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
    <button type="button" class="bm-card-action-btn open-btn" title="Open in New Tab">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    </button>
  `;
}

function attachRowEventHandlers(el, bm) {
  const handleNavigate = (e) => {
    if (e.target.closest('.bm-card-actions') || e.target.closest('.col-actions') || e.target.closest('a') || e.target.closest('button')) return;
    window.open(bm.url, '_blank');
  };

  el.addEventListener('click', handleNavigate);
  el.addEventListener('auxclick', handleNavigate);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleNavigate(e);
  });

  const copyBtn = el.querySelector('.copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(bm.url).then(() => {
        showToast('Link copied to clipboard ✓');
      }).catch(() => {
        showToast('Failed to copy link');
      });
    });
  }

  const openBtn = el.querySelector('.open-btn');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(bm.url, '_blank');
    });
  }

  const editBtn = el.querySelector('.edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(bm);
    });
  }

  const delBtn = el.querySelector('.delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete bookmark "${bm.title}"?`)) {
        bookmarks = bookmarks.filter(b => b.id !== bm.id);
        renderAll();
        showToast('Bookmark deleted');
        try {
          await apiRequest(`/api/bookmarks/${bm.id}`, 'DELETE');
        } catch (err) {
          console.error(err);
        }
      }
    });
  }
}

/* ========== Master Render ========== */

function renderAll() {
  renderGroups();
  renderBrowserChips();
  renderBookmarks();
  updateGroupSelect();
}

/* ========== Group Select Options for Modal ========== */

function updateGroupSelect() {
  if (!bmFormGroup) return;
  const groups = getGroups();
  const names = Object.keys(groups).sort();

  const prev = bmFormGroup.value;
  bmFormGroup.innerHTML = '';

  const allNames = new Set(['Default', ...names]);
  allNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    bmFormGroup.appendChild(opt);
  });

  if ([...allNames].includes(prev)) {
    bmFormGroup.value = prev;
  }
}

/* ========== Modals (Add / Edit / Rename) ========== */

function openAddModal() {
  bmModalTitle.textContent = 'Add Bookmark';
  bmFormId.value = '';
  bmFormTitle.value = '';
  bmFormUrl.value = '';
  updateGroupSelect();
  const defaultGroup = (activeGroup && !activeGroup.startsWith('__browser__:')) ? activeGroup : 'Default';
  bmFormGroup.value = defaultGroup;
  deleteBmBtn.style.display = 'none';
  bookmarkModal.style.display = 'flex';
  bmFormTitle.focus();
}

function openEditModal(bm) {
  bmModalTitle.textContent = 'Edit Bookmark';
  bmFormId.value = bm.id;
  bmFormTitle.value = bm.title;
  bmFormUrl.value = bm.url;
  updateGroupSelect();
  bmFormGroup.value = bm.group || 'Default';
  deleteBmBtn.style.display = 'inline-flex';
  bookmarkModal.style.display = 'flex';
  bmFormTitle.focus();
}

function closeModal(modal) {
  if (modal) modal.style.display = 'none';
}

/* ========== Event Setup ========== */

function setupEvents() {
  // Theme toggle
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // Search input typing
  if (bmSearch) {
    bmSearch.addEventListener('input', () => {
      searchQuery = bmSearch.value.trim();
      if (bmSearchClear) {
        bmSearchClear.style.display = searchQuery ? 'flex' : 'none';
      }
      renderBookmarks();
    });
  }

  // Clear search
  if (bmSearchClear) {
    bmSearchClear.addEventListener('click', () => {
      bmSearch.value = '';
      searchQuery = '';
      bmSearchClear.style.display = 'none';
      bmSearch.focus();
      renderBookmarks();
    });
  }

  // View mode switcher (Grid, List, Compact)
  document.querySelectorAll('.bm-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bm-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderBookmarks();
    });
  });

  // Sort dropdown
  if (bmSortSelect) {
    bmSortSelect.addEventListener('change', () => {
      currentSort = bmSortSelect.value;
      renderBookmarks();
    });
  }

  // Breadcrumb root click (reset to all)
  const rootCrumb = document.querySelector('.bm-crumb-root');
  if (rootCrumb) {
    rootCrumb.addEventListener('click', () => {
      activeGroup = null;
      activeBrowserFilter = null;
      renderAll();
    });
  }

  // Add bookmark buttons
  if (addBookmarkBtn) addBookmarkBtn.addEventListener('click', openAddModal);
  if (emptyAddBtn) emptyAddBtn.addEventListener('click', openAddModal);

  // Add group button in sidebar
  if (addGroupBtn) {
    addGroupBtn.addEventListener('click', () => {
      const name = prompt('Enter new collection name:');
      if (!name || !name.trim()) return;
      activeGroup = name.trim();
      renderAll();
      showToast(`Group "${activeGroup}" created`);
    });
  }

  // Bookmark form submit
  if (bmForm) {
    bmForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = bmFormId.value;
      const title = bmFormTitle.value.trim();
      let url = bmFormUrl.value.trim();
      const group = bmFormGroup.value;

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      closeModal(bookmarkModal);

      if (id) {
        const idx = bookmarks.findIndex(b => b.id === id);
        if (idx !== -1) {
          bookmarks[idx] = { ...bookmarks[idx], title, url, group };
          renderAll();
        }
        showToast('Bookmark updated ✓');
        await apiRequest(`/api/bookmarks/${id}`, 'PUT', { title, url, group });
      } else {
        showToast('Saving bookmark...');
        const saved = await apiRequest('/api/bookmarks', 'POST', { title, url, group });
        bookmarks.unshift(saved);
        renderAll();
        showToast('Bookmark saved ✓');
      }
    });
  }

  // Delete button inside modal
  if (deleteBmBtn) {
    deleteBmBtn.addEventListener('click', async () => {
      const id = bmFormId.value;
      if (id && confirm('Delete this bookmark?')) {
        closeModal(bookmarkModal);
        bookmarks = bookmarks.filter(b => b.id !== id);
        renderAll();
        showToast('Bookmark deleted');
        await apiRequest(`/api/bookmarks/${id}`, 'DELETE');
      }
    });
  }

  // Inline new group option inside modal
  if (bmNewGroupInline) {
    bmNewGroupInline.addEventListener('click', () => {
      const name = prompt('New collection name:');
      if (!name || !name.trim()) return;
      const trimmed = name.trim();
      const opt = document.createElement('option');
      opt.value = trimmed;
      opt.textContent = trimmed;
      bmFormGroup.appendChild(opt);
      bmFormGroup.value = trimmed;
    });
  }

  // Close modals
  if (closeBmModal) closeBmModal.addEventListener('click', () => closeModal(bookmarkModal));
  if (cancelBmModal) cancelBmModal.addEventListener('click', () => closeModal(bookmarkModal));

  // Rename group
  if (renameGroupBtn) {
    renameGroupBtn.addEventListener('click', () => {
      if (!activeGroup || activeGroup.startsWith('__browser__:')) return;
      renameInput.value = activeGroup;
      renameModal.style.display = 'flex';
      renameInput.focus();
      renameInput.select();
    });
  }

  if (renameForm) {
    renameForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newName = renameInput.value.trim();
      if (!newName || newName === activeGroup) {
        closeModal(renameModal);
        return;
      }
      const oldName = activeGroup;
      closeModal(renameModal);

      // Local optimistic update
      bookmarks.forEach(b => {
        if (b.group === oldName) b.group = newName;
      });
      activeGroup = newName;
      renderAll();
      showToast(`Renamed to "${newName}"`);

      await apiRequest('/api/bookmarks/groups/rename', 'PUT', { oldName, newName });
    });
  }

  if (closeRenameModal) closeRenameModal.addEventListener('click', () => closeModal(renameModal));
  if (cancelRenameModal) cancelRenameModal.addEventListener('click', () => closeModal(renameModal));

  // Delete group
  if (deleteGroupBtn) {
    deleteGroupBtn.addEventListener('click', async () => {
      if (!activeGroup || activeGroup.startsWith('__browser__:')) return;
      const count = bookmarks.filter(bm => (bm.group || 'Ungrouped') === activeGroup).length;
      if (!confirm(`Delete collection "${activeGroup}" and its ${count} bookmark(s)?`)) return;

      const delGroup = activeGroup;
      bookmarks = bookmarks.filter(bm => (bm.group || 'Ungrouped') !== delGroup);
      activeGroup = null;
      renderAll();
      showToast(`Collection "${delGroup}" deleted`);

      await apiRequest(`/api/bookmarks/groups/${encodeURIComponent(delGroup)}`, 'DELETE');
    });
  }

  // Click outside to close modals
  window.addEventListener('click', (e) => {
    if (e.target === bookmarkModal) closeModal(bookmarkModal);
    if (e.target === renameModal) closeModal(renameModal);
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape key closes modals or clears search
    if (e.key === 'Escape') {
      if (bookmarkModal && bookmarkModal.style.display !== 'none') closeModal(bookmarkModal);
      if (renameModal && renameModal.style.display !== 'none') closeModal(renameModal);
      if (document.activeElement === bmSearch) {
        bmSearch.value = '';
        searchQuery = '';
        if (bmSearchClear) bmSearchClear.style.display = 'none';
        bmSearch.blur();
        renderBookmarks();
      }
    }

    // Ctrl + K or / focuses search
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== bmSearch && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      if (bmSearch) {
        bmSearch.focus();
        bmSearch.select();
      }
    }
  });
}

/* ========== Initialize on DOM Ready ========== */

document.addEventListener('DOMContentLoaded', () => {
  initDOMElements();
  setupEvents();

  // Load state from backend
  apiRequest('/api/state').then(data => {
    bookmarks = data.bookmarks || [];
    applyTheme(data.settings?.theme || 'dark');
    renderAll();
  }).catch(err => {
    console.error('Failed to load state:', err);
  });

  setupSSE();
});
