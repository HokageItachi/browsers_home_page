/**
 * Password Vault — Client-Side Controller
 * Full-featured password manager with:
 * - Auto-fetch & sync across Chrome, Edge & Brave browser profiles
 * - 3 View modes (Spacious Grid Cards, Detailed List, Razor-Sharp Compact Table)
 * - Profile and category navigation with browser branding
 * - Quick browser filter chips (All, Chrome, Edge, Brave)
 * - Sorting by newest, oldest, title, domain, updated, strength
 * - Instant inline password reveal & copy (with auto-clear clipboard timer)
 * - Real-time password strength meter & generator
 * - Tagging, notes, favourites & weak-password auditing
 * - Real-time SSE synchronization across all browser tabs
 * - Export to JSON
 */

const CLIENT_ID = 'pm-client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

let passwords = [];
let activeCategory = null;       // null = All, or '__browser__:Chrome', '__starred__', '__weak__', or category name
let activeBrowserFilter = null;  // null = All, or 'Chrome', 'Edge', 'Brave'
let searchQuery = '';
let currentView = 'grid';        // 'grid' | 'list' | 'compact'
let currentSort = 'newest';
let toastTimeout = null;
let formTags = [];
let generatedPasswordBuffer = '';
const revealedPasswords = new Set(); // IDs of passwords currently unmasked in the UI

// ── Browser Icons ────────────────────────────────────────────────────────────

const BROWSER_ICONS = {
  Chrome: `<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#4285F4"/><circle cx="12" cy="12" r="4.5" fill="#fff"/><path d="M12 7.5A4.5 4.5 0 0 0 8.2 10L3.5 10A10 10 0 0 1 12 2a10 10 0 0 1 8.5 4.7L16.8 13A4.5 4.5 0 0 0 12 7.5z" fill="#EA4335"/><path d="M16.8 13a4.5 4.5 0 0 1-8.6-1H3.5A10 10 0 0 0 12 22a10 10 0 0 0 4.3-1L12 13.5a4.5 4.5 0 0 0 4.8-.5z" fill="#34A853"/><path d="M16.3 6.7L12 13.5a4.5 4.5 0 0 0 4.8-.5l3.7 6.5A10 10 0 0 0 22 12a10 10 0 0 0-1.5-5.3z" fill="#FBBC05"/></svg>`,
  Edge: `<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="12" r="10" fill="#0078D4"/><path d="M7 15.5c0-2.5 2-4.5 5-4.5s5 2 5 4.5c0 2.2-2 4-5 4s-5-1.8-5-4z" fill="#50E6FF"/><path d="M6.5 10c0-3 2.5-5.5 5.5-5.5 2.3 0 4.2 1.4 5 3.4-.8-1.2-2.5-2-4.5-2C9 5.9 6.5 7.8 6.5 10z" fill="#fff"/></svg>`,
  Brave: `<svg viewBox="0 0 24 24" width="14" height="14"><path d="M12 2L3 7v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z" fill="#FB542B"/><path d="M12 5l5 3v4c0 3.5-2.2 6.8-5 7.9-2.8-1.1-5-4.4-5-7.9V8l5-3z" fill="#fff"/></svg>`,
};

const CATEGORY_ICONS = {
  'General':        '🔑',
  'Social':         '💬',
  'Email':          '📧',
  'Banking':        '🏦',
  'Shopping':       '🛒',
  'Work':           '💼',
  'Entertainment':  '🎬',
  'Gaming':         '🎮',
  'Travel':         '✈️',
  'Health':         '🏥',
  'Education':      '📚',
  'Developer':      '💻',
};

function getCategoryIcon(name) {
  return CATEGORY_ICONS[name] || '📁';
}

// ── DOM References ──────────────────────────────────────────────────────────

let pmSearch, pmSearchClear, passwordsGrid, pmEmpty, pmEmptyText, totalCount;
let categoryList, activeCategoryTitle, activeResultsCount, categoryActions;
let renameCategoryBtn, deleteCategoryBtn, pmSortSelect, pmToast, browserChips;
let statStrong, statMedium, statWeak;
let passwordModal, pmForm, pmModalTitle, pmFormId, pmFormTitle, pmFormUrl;
let pmFormUsername, pmFormPassword, pmToggleFormPwd, pmGenerateInline;
let pmFormCategory, pmFormNotes, pmFormTagsInput, pmTagsList;
let closePmModal, cancelPmModal, deletePmBtn, pmNewCatInline;
let formStrengthBar, formStrengthLabel, importedMetaWrap, importedMetaBadge;
let renameCatModal, renameCatForm, renameCatInput, closeRenameCatModal, cancelRenameCatModal;
let generatorModal, genPwdOutput, genCopyBtn, genStrengthBar, genStrengthLabel;
let genLength, genLengthVal, genUpper, genLower, genNumbers, genSymbols, genExcludeAmbiguous;
let genRefreshBtn, genUseBtn, closeGeneratorModal;
let addPasswordBtn, addCategoryBtn, openGeneratorBtn, syncProfilesBtn, exportBtn, themeToggleBtn;
let emptyAddBtn, emptySyncBtn, crumbRoot;

function initDOMElements() {
  pmSearch = document.getElementById('pmSearch');
  pmSearchClear = document.getElementById('pmSearchClear');
  passwordsGrid = document.getElementById('passwordsGrid');
  pmEmpty = document.getElementById('pmEmpty');
  pmEmptyText = document.getElementById('pmEmptyText');
  totalCount = document.getElementById('totalCount');
  emptyAddBtn = document.getElementById('emptyAddBtn');
  emptySyncBtn = document.getElementById('emptySyncBtn');
  categoryList = document.getElementById('categoryList');
  activeCategoryTitle = document.getElementById('activeCategoryTitle');
  activeResultsCount = document.getElementById('activeResultsCount');
  categoryActions = document.getElementById('categoryActions');
  renameCategoryBtn = document.getElementById('renameCategoryBtn');
  deleteCategoryBtn = document.getElementById('deleteCategoryBtn');
  pmSortSelect = document.getElementById('pmSortSelect');
  pmToast = document.getElementById('pmToast');
  browserChips = document.getElementById('browserChips');
  statStrong = document.getElementById('statStrong');
  statMedium = document.getElementById('statMedium');
  statWeak = document.getElementById('statWeak');
  crumbRoot = document.getElementById('crumbRoot');

  // Password Modal
  passwordModal = document.getElementById('passwordModal');
  pmForm = document.getElementById('pmForm');
  pmModalTitle = document.getElementById('pmModalTitle');
  pmFormId = document.getElementById('pmFormId');
  pmFormTitle = document.getElementById('pmFormTitle');
  pmFormUrl = document.getElementById('pmFormUrl');
  pmFormUsername = document.getElementById('pmFormUsername');
  pmFormPassword = document.getElementById('pmFormPassword');
  pmToggleFormPwd = document.getElementById('pmToggleFormPwd');
  pmGenerateInline = document.getElementById('pmGenerateInline');
  pmFormCategory = document.getElementById('pmFormCategory');
  pmFormNotes = document.getElementById('pmFormNotes');
  pmFormTagsInput = document.getElementById('pmFormTagsInput');
  pmTagsList = document.getElementById('pmTagsList');
  closePmModal = document.getElementById('closePmModal');
  cancelPmModal = document.getElementById('cancelPmModal');
  deletePmBtn = document.getElementById('deletePmBtn');
  pmNewCatInline = document.getElementById('pmNewCatInline');
  formStrengthBar = document.getElementById('formStrengthBar');
  formStrengthLabel = document.getElementById('formStrengthLabel');
  importedMetaWrap = document.getElementById('importedMetaWrap');
  importedMetaBadge = document.getElementById('importedMetaBadge');

  // Rename Category Modal
  renameCatModal = document.getElementById('renameCatModal');
  renameCatForm = document.getElementById('renameCatForm');
  renameCatInput = document.getElementById('renameCatInput');
  closeRenameCatModal = document.getElementById('closeRenameCatModal');
  cancelRenameCatModal = document.getElementById('cancelRenameCatModal');

  // Generator Modal
  generatorModal = document.getElementById('generatorModal');
  genPwdOutput = document.getElementById('genPwdOutput');
  genCopyBtn = document.getElementById('genCopyBtn');
  genStrengthBar = document.getElementById('genStrengthBar');
  genStrengthLabel = document.getElementById('genStrengthLabel');
  genLength = document.getElementById('genLength');
  genLengthVal = document.getElementById('genLengthVal');
  genUpper = document.getElementById('genUpper');
  genLower = document.getElementById('genLower');
  genNumbers = document.getElementById('genNumbers');
  genSymbols = document.getElementById('genSymbols');
  genExcludeAmbiguous = document.getElementById('genExcludeAmbiguous');
  genRefreshBtn = document.getElementById('genRefreshBtn');
  genUseBtn = document.getElementById('genUseBtn');
  closeGeneratorModal = document.getElementById('closeGeneratorModal');

  // Action Buttons
  addPasswordBtn = document.getElementById('addPasswordBtn');
  addCategoryBtn = document.getElementById('addCategoryBtn');
  openGeneratorBtn = document.getElementById('openGeneratorBtn');
  syncProfilesBtn = document.getElementById('syncProfilesBtn');
  exportBtn = document.getElementById('exportBtn');
  themeToggleBtn = document.getElementById('themeToggleBtn');
}

// ── API ─────────────────────────────────────────────────────────────────────

async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Client-ID': CLIENT_ID }
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(endpoint, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Real-time SSE ───────────────────────────────────────────────────────────

function setupSSE() {
  const evtSource = new EventSource('/api/events');

  evtSource.addEventListener('init', (e) => {
    try {
      const data = JSON.parse(e.data);
      passwords = data.passwords || [];
      applyTheme(data.settings?.theme || 'dark');
      renderAll();
    } catch (err) { console.error(err); }
  });

  evtSource.addEventListener('passwords_updated', (e) => {
    try {
      const { passwords: updated } = JSON.parse(e.data);
      passwords = updated || [];
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

// ── Theme ───────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  apiRequest('/api/settings', 'PUT', { theme: next });
}

// ── Toast ───────────────────────────────────────────────────────────────────

function showToast(message) {
  if (!pmToast) return;
  pmToast.textContent = message;
  pmToast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => pmToast.classList.remove('show'), 2600);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function getDomain(url) {
  try {
    const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return (url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || '';
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
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

function maskPassword(pwd) {
  if (!pwd) return '—';
  return '•'.repeat(Math.min(Math.max(pwd.length, 8), 14));
}

// ── Strength Analysis ───────────────────────────────────────────────────────

function analyzeStrength(pwd) {
  if (!pwd) return { score: 0, pct: 0, label: 'Empty', level: 'weak', color: '#64748b' };

  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (pwd.length >= 16) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (/^(.)\1+$/.test(pwd)) score = Math.max(0, score - 3);
  if (/^(012|123|234|345|456|567|678|789|890|abc|qwe|asd)/i.test(pwd)) score = Math.max(0, score - 2);

  const pct = Math.min(100, Math.round((score / 7) * 100));

  let level, label, color;
  if (score <= 2) { level = 'weak'; label = 'Weak'; color = '#ef4444'; }
  else if (score <= 4) { level = 'medium'; label = 'Medium'; color = '#f59e0b'; }
  else { level = 'strong'; label = 'Strong'; color = '#10b981'; }

  return { score, pct, label, level, color };
}

function applyStrengthToBar(bar, labelEl, strength) {
  if (!bar) return;
  bar.style.width = strength.pct + '%';
  bar.style.background = strength.color || '';
  if (labelEl) {
    labelEl.textContent = strength.label || '';
    labelEl.style.color = strength.color || '';
  }
}

// ── Data Aggregations ───────────────────────────────────────────────────────

function getCategories() {
  const cats = {};
  passwords.forEach(p => {
    const c = p.category || 'General';
    cats[c] = (cats[c] || 0) + 1;
  });
  return cats;
}

function getBrowserSources() {
  const sources = {};
  passwords.forEach(p => {
    if (p.browserSource) {
      sources[p.browserSource] = (sources[p.browserSource] || 0) + 1;
    }
  });
  return sources;
}

function getBrowserGroups() {
  const groups = {};
  passwords.forEach(p => {
    if (p.group && /^(Chrome|Edge|Brave)\s*—\s*/.test(p.group)) {
      groups[p.group] = (groups[p.group] || 0) + 1;
    }
  });
  return groups;
}

// ── Filtering & Sorting ─────────────────────────────────────────────────────

function getFilteredAndSorted() {
  let list = [...passwords];

  // 1. Sidebar Category/Browser/Profile Filter
  if (activeCategory) {
    if (activeCategory === '__starred__') {
      list = list.filter(p => p.starred);
    } else if (activeCategory === '__weak__') {
      list = list.filter(p => analyzeStrength(p.password).level === 'weak');
    } else if (activeCategory.startsWith('__browser__:')) {
      const browser = activeCategory.replace('__browser__:', '');
      list = list.filter(p => p.browserSource === browser);
    } else if (activeCategory.startsWith('__group__:')) {
      const groupName = activeCategory.replace('__group__:', '');
      list = list.filter(p => p.group === groupName);
    } else {
      list = list.filter(p => (p.category || 'General') === activeCategory);
    }
  }

  // 2. Browser Quick Chips Filter
  if (activeBrowserFilter) {
    list = list.filter(p => p.browserSource === activeBrowserFilter);
  }

  // 3. Search Filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(p =>
      (p.title || '').toLowerCase().includes(q) ||
      (p.username || '').toLowerCase().includes(q) ||
      (p.url || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q) ||
      (p.browserSource || '').toLowerCase().includes(q) ||
      (p.profileName || '').toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  // 4. Sort
  list.sort((a, b) => {
    switch (currentSort) {
      case 'newest':   return (b.createdAt || 0) - (a.createdAt || 0);
      case 'oldest':   return (a.createdAt || 0) - (b.createdAt || 0);
      case 'title_asc': return (a.title || '').localeCompare(b.title || '');
      case 'title_desc': return (b.title || '').localeCompare(a.title || '');
      case 'domain':   return getDomain(a.url).localeCompare(getDomain(b.url));
      case 'updated':  return (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0);
      case 'strength': {
        const order = { weak: 0, medium: 1, strong: 2 };
        return (order[analyzeStrength(b.password).level] || 0) - (order[analyzeStrength(a.password).level] || 0);
      }
      default: return 0;
    }
  });

  return list;
}

// ── Sidebar Rendering ───────────────────────────────────────────────────────

function renderCategories() {
  if (!categoryList) return;
  const cats = getCategories();
  const browsers = getBrowserSources();
  const browserGroups = getBrowserGroups();

  categoryList.innerHTML = '';

  // 1. All Passwords
  appendCatItem(categoryList, {
    label: 'All Passwords',
    count: passwords.length,
    icon: '🔐',
    isActive: activeCategory === null && activeBrowserFilter === null,
    onClick: () => { activeCategory = null; activeBrowserFilter = null; renderAll(); }
  });

  // 2. Favourites
  const starredCount = passwords.filter(p => p.starred).length;
  if (starredCount > 0) {
    appendCatItem(categoryList, {
      label: 'Favourites',
      count: starredCount,
      icon: '⭐',
      isActive: activeCategory === '__starred__',
      onClick: () => { activeCategory = '__starred__'; activeBrowserFilter = null; renderAll(); }
    });
  }

  // 3. Weak Passwords
  const weakCount = passwords.filter(p => analyzeStrength(p.password).level === 'weak').length;
  if (weakCount > 0) {
    appendCatItem(categoryList, {
      label: 'Weak Passwords',
      count: weakCount,
      icon: '⚠️',
      isActive: activeCategory === '__weak__',
      onClick: () => { activeCategory = '__weak__'; activeBrowserFilter = null; renderAll(); }
    });
  }

  // 4. Browsers Section
  if (Object.keys(browsers).length > 0) {
    const div = document.createElement('div');
    div.className = 'pm-sidebar-divider';
    div.innerHTML = '<span>Browsers</span>';
    categoryList.appendChild(div);

    Object.keys(browsers).sort().forEach(bName => {
      appendCatItem(categoryList, {
        label: bName,
        count: browsers[bName],
        icon: BROWSER_ICONS[bName] || '🌐',
        isActive: activeCategory === `__browser__:${bName}`,
        onClick: () => { activeCategory = `__browser__:${bName}`; activeBrowserFilter = null; renderAll(); }
      });
    });
  }

  // 5. Profiles Section
  if (Object.keys(browserGroups).length > 0) {
    const div = document.createElement('div');
    div.className = 'pm-sidebar-divider';
    div.innerHTML = '<span>Browser Profiles</span>';
    categoryList.appendChild(div);

    Object.keys(browserGroups).sort().forEach(groupName => {
      const match = groupName.match(/^(Chrome|Edge|Brave)\s*—\s*(.+)$/);
      const bName = match ? match[1] : '';
      const pLabel = match ? match[2] : groupName;

      appendCatItem(categoryList, {
        label: pLabel,
        count: browserGroups[groupName],
        icon: BROWSER_ICONS[bName] || '👤',
        isActive: activeCategory === `__group__:${groupName}`,
        onClick: () => { activeCategory = `__group__:${groupName}`; activeBrowserFilter = null; renderAll(); }
      });
    });
  }

  // 6. Custom Categories
  if (Object.keys(cats).length > 0) {
    const div = document.createElement('div');
    div.className = 'pm-sidebar-divider';
    div.innerHTML = '<span>Categories</span>';
    categoryList.appendChild(div);

    Object.keys(cats).sort().forEach(name => {
      appendCatItem(categoryList, {
        label: name,
        count: cats[name],
        icon: getCategoryIcon(name),
        isActive: activeCategory === name,
        onClick: () => { activeCategory = name; activeBrowserFilter = null; renderAll(); }
      });
    });
  }
}

function appendCatItem(parent, { label, count, icon, isActive, onClick }) {
  const btn = document.createElement('button');
  btn.className = `pm-cat-item ${isActive ? 'active' : ''}`;
  btn.title = label;
  btn.innerHTML = `
    <span class="pm-cat-icon">${icon}</span>
    <span class="pm-cat-label">${escapeHtml(label)}</span>
    <span class="pm-cat-count">${count}</span>
  `;
  btn.addEventListener('click', onClick);
  parent.appendChild(btn);
}

// ── Browser Quick Chips ─────────────────────────────────────────────────────

function renderBrowserChips() {
  if (!browserChips) return;
  const browsers = getBrowserSources();
  const keys = Object.keys(browsers).sort();

  if (keys.length === 0) {
    browserChips.innerHTML = '';
    return;
  }

  browserChips.innerHTML = '';

  const allChip = document.createElement('button');
  allChip.type = 'button';
  allChip.className = `pm-browser-chip ${activeBrowserFilter === null ? 'active' : ''}`;
  allChip.innerHTML = `<span>All</span>`;
  allChip.addEventListener('click', () => {
    activeBrowserFilter = null;
    renderPasswords();
    renderBrowserChips();
  });
  browserChips.appendChild(allChip);

  keys.forEach(b => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `pm-browser-chip ${activeBrowserFilter === b ? 'active' : ''}`;
    chip.innerHTML = `${BROWSER_ICONS[b] || ''} <span>${b}</span>`;
    chip.addEventListener('click', () => {
      activeBrowserFilter = activeBrowserFilter === b ? null : b;
      renderPasswords();
      renderBrowserChips();
    });
    browserChips.appendChild(chip);
  });
}

// ── Strength Stats ──────────────────────────────────────────────────────────

function renderStrengthStats() {
  if (!statStrong) return;
  let strong = 0, medium = 0, weak = 0;
  passwords.forEach(p => {
    const s = analyzeStrength(p.password).level;
    if (s === 'strong') strong++;
    else if (s === 'medium') medium++;
    else weak++;
  });
  statStrong.textContent = strong;
  statMedium.textContent = medium;
  statWeak.textContent = weak;
}

// ── Passwords View Rendering ────────────────────────────────────────────────

function renderPasswords() {
  if (!passwordsGrid || !pmEmpty || !totalCount) return;

  const filtered = getFilteredAndSorted();

  totalCount.textContent = `${passwords.length} password${passwords.length !== 1 ? 's' : ''}`;
  if (activeResultsCount) {
    activeResultsCount.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''}`;
  }

  // Breadcrumbs
  if (activeCategoryTitle) {
    if (!activeCategory) {
      activeCategoryTitle.textContent = activeBrowserFilter ? `${activeBrowserFilter} Passwords` : 'All Passwords';
    } else if (activeCategory === '__starred__') {
      activeCategoryTitle.textContent = 'Favourites';
    } else if (activeCategory === '__weak__') {
      activeCategoryTitle.textContent = 'Weak Passwords';
    } else if (activeCategory.startsWith('__browser__:')) {
      activeCategoryTitle.textContent = activeCategory.replace('__browser__:', '') + ' Passwords';
    } else if (activeCategory.startsWith('__group__:')) {
      activeCategoryTitle.textContent = activeCategory.replace('__group__:', '');
    } else {
      activeCategoryTitle.textContent = activeCategory;
    }
  }

  // Rename/Delete actions for custom categories only
  if (categoryActions) {
    const isCustom = activeCategory && !activeCategory.startsWith('__');
    categoryActions.style.display = isCustom ? 'flex' : 'none';
  }

  passwordsGrid.className = `pm-grid view-${currentView}`;

  if (filtered.length === 0) {
    passwordsGrid.style.display = 'none';
    pmEmpty.style.display = 'flex';
    if (pmEmptyText) {
      pmEmptyText.textContent = searchQuery
        ? `No passwords matching "${searchQuery}". Press Esc to clear search.`
        : 'No passwords in this collection. Click Add Password or Fetch from Profiles.';
    }
    return;
  }

  pmEmpty.style.display = 'none';
  passwordsGrid.style.display = '';
  passwordsGrid.innerHTML = '';

  if (currentView === 'grid') renderGridView(filtered);
  else if (currentView === 'list') renderListView(filtered);
  else if (currentView === 'compact') renderCompactView(filtered);
}

// ── View 1: Grid Cards ──────────────────────────────────────────────────────

function renderGridView(items) {
  items.forEach(pw => {
    const domain = getDomain(pw.url || '');
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}` : '';
    const initial = (pw.title || domain || 'P')[0].toUpperCase();
    const strength = analyzeStrength(pw.password);
    const relTime = formatRelativeTime(pw.updatedAt || pw.createdAt);
    const isRevealed = revealedPasswords.has(pw.id);
    const displayPwd = isRevealed ? escapeHtml(pw.password || '(none)') : maskPassword(pw.password);

    const card = document.createElement('div');
    card.className = 'pm-card';
    card.setAttribute('tabindex', '0');

    card.innerHTML = `
      <div class="pm-card-top">
        <div class="pm-card-icon">
          ${faviconUrl
            ? `<img src="${faviconUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" /><span class="pm-fallback-letter" style="display:none;">${initial}</span>`
            : `<span class="pm-fallback-letter">${initial}</span>`}
        </div>
        <div class="pm-card-info">
          <div class="pm-card-title" title="${escapeHtml(pw.title)}">${escapeHtml(pw.title)}</div>
          <div class="pm-card-username" title="${escapeHtml(pw.username)}">${escapeHtml(pw.username || '—')}</div>
        </div>
        <button type="button" class="pm-card-action-btn star-btn" title="${pw.starred ? 'Unstar' : 'Star'}" style="margin-left:auto;flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="${pw.starred ? '#f59e0b' : 'none'}">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
      </div>

      <div class="pm-card-meta">
        ${getSourceBadgeHtml(pw)}
        <span class="pm-cat-badge">${getCategoryIcon(pw.category || 'General')} ${escapeHtml(pw.category || 'General')}</span>
        <span class="pm-strength-badge ${strength.level}">${strength.label}</span>
      </div>

      <div class="pm-card-bottom">
        <div>
          <div class="pm-card-pwd-preview" style="font-family:${isRevealed ? 'monospace' : 'inherit'};font-size:${isRevealed ? '0.8rem' : '0.72rem'};color:${isRevealed ? '#10b981' : 'var(--text-dim)'};">${displayPwd}</div>
          <div class="pm-card-date">${relTime ? 'Updated ' + relTime : ''}</div>
        </div>
        <div class="pm-card-actions">
          ${getCardActionsHtml(isRevealed)}
        </div>
      </div>
    `;

    attachCardHandlers(card, pw);
    passwordsGrid.appendChild(card);
  });
}

// ── View 2: Detailed List ───────────────────────────────────────────────────

function renderListView(items) {
  const header = document.createElement('div');
  header.className = 'pm-list-header';
  header.innerHTML = `
    <div class="th-main">Site &amp; Username</div>
    <div class="th-source">Browser / Profile</div>
    <div class="th-category">Category</div>
    <div class="th-strength">Strength</div>
    <div class="th-actions">Actions</div>
  `;
  passwordsGrid.appendChild(header);

  items.forEach(pw => {
    const domain = getDomain(pw.url || '');
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}` : '';
    const initial = (pw.title || domain || 'P')[0].toUpperCase();
    const strength = analyzeStrength(pw.password);
    const isRevealed = revealedPasswords.has(pw.id);

    const row = document.createElement('div');
    row.className = 'pm-list-row';
    row.setAttribute('tabindex', '0');

    row.innerHTML = `
      <div class="col-main">
        <div class="pm-list-favicon">
          ${faviconUrl
            ? `<img src="${faviconUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" /><span class="pm-fallback-letter" style="display:none;font-size:.8rem;font-weight:700;color:#10b981;">${initial}</span>`
            : `<span class="pm-fallback-letter" style="font-size:.8rem;font-weight:700;color:#10b981;">${initial}</span>`}
        </div>
        <div class="pm-list-info">
          <div class="pm-list-title" title="${escapeHtml(pw.title)}">${escapeHtml(pw.title)}</div>
          <div class="pm-list-username" title="${escapeHtml(pw.username)}">${escapeHtml(pw.username || '—')}</div>
        </div>
      </div>
      <div class="col-source">
        ${getSourceBadgeHtml(pw)}
      </div>
      <div class="col-category">
        <span class="pm-cat-badge">${getCategoryIcon(pw.category || 'General')} ${escapeHtml(pw.category || 'General')}</span>
      </div>
      <div class="col-strength">
        <span class="pm-strength-badge ${strength.level}">${strength.label}</span>
      </div>
      <div class="col-actions">
        ${getCardActionsHtml(isRevealed)}
      </div>
    `;

    attachCardHandlers(row, pw);
    passwordsGrid.appendChild(row);
  });
}

// ── View 3: Compact Table ───────────────────────────────────────────────────

function renderCompactView(items) {
  const header = document.createElement('div');
  header.className = 'pm-compact-header';
  header.innerHTML = `
    <div class="th-icon"></div>
    <div class="th-main">Site &amp; Username</div>
    <div class="th-username">Password</div>
    <div class="th-category">Source &amp; Profile</div>
    <div class="th-actions">Actions</div>
  `;
  passwordsGrid.appendChild(header);

  items.forEach(pw => {
    const domain = getDomain(pw.url || '');
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?sz=64&domain=${domain}` : '';
    const initial = (pw.title || domain || 'P')[0].toUpperCase();
    const isRevealed = revealedPasswords.has(pw.id);
    const displayPwd = isRevealed ? escapeHtml(pw.password || '(none)') : maskPassword(pw.password);

    const row = document.createElement('div');
    row.className = 'pm-compact-row';
    row.setAttribute('tabindex', '0');

    row.innerHTML = `
      <div class="col-icon">
        ${faviconUrl
          ? `<img src="${faviconUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" /><span style="display:none;font-size:.7rem;font-weight:700;color:#10b981;">${initial}</span>`
          : `<span style="font-size:.7rem;font-weight:700;color:#10b981;">${initial}</span>`}
      </div>
      <div class="col-title" title="${escapeHtml(pw.title)}">
        ${escapeHtml(pw.title)}
        <span style="font-size:0.72rem;color:var(--text-dim);margin-left:6px;">(${escapeHtml(pw.username || '—')})</span>
      </div>
      <div class="col-username" style="font-family:monospace;font-size:0.74rem;color:${isRevealed ? '#10b981' : 'var(--text-dim)'};">
        ${displayPwd}
      </div>
      <div class="col-category">
        ${getSourceBadgeHtml(pw)}
      </div>
      <div class="col-actions">
        ${getCardActionsHtml(isRevealed)}
      </div>
    `;

    attachCardHandlers(row, pw);
    passwordsGrid.appendChild(row);
  });
}

// ── Badges & Actions HTML ───────────────────────────────────────────────────

function getSourceBadgeHtml(pw) {
  if (pw.browserSource) {
    const bIcon = BROWSER_ICONS[pw.browserSource] || '';
    const pName = pw.profileName ? escapeHtml(pw.profileName) : pw.browserSource;
    return `
      <span class="pm-browser-badge" title="Imported from ${escapeHtml(pw.browserSource)} (${pName})">
        ${bIcon}
        <span>${pName}</span>
      </span>
    `;
  }
  return `
    <span class="pm-browser-badge" title="Custom manual entry">
      <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      <span>Manual</span>
    </span>
  `;
}

function getCardActionsHtml(isRevealed) {
  return `
    <button type="button" class="pm-card-action-btn reveal-btn" title="${isRevealed ? 'Hide Password' : 'Show Password'}">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        ${isRevealed
          ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
          : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`}
      </svg>
    </button>
    <button type="button" class="pm-card-action-btn copy-pwd-btn" title="Copy Password">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <rect x="9" y="9" width="13" height="13" rx="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
    <button type="button" class="pm-card-action-btn copy-user-btn" title="Copy Username">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    </button>
    <button type="button" class="pm-card-action-btn open-btn" title="Open Website">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
        <polyline points="15 3 21 3 21 9"></polyline>
        <line x1="10" y1="14" x2="21" y2="3"></line>
      </svg>
    </button>
    <button type="button" class="pm-card-action-btn edit-btn" title="Edit Entry">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    </button>
    <button type="button" class="pm-card-action-btn delete-btn" title="Delete Entry">
      <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    </button>
  `;
}

// ── Card Handlers ───────────────────────────────────────────────────────────

function attachCardHandlers(el, pw) {
  // Inline Reveal Toggle
  const revealBtn = el.querySelector('.reveal-btn');
  if (revealBtn) {
    revealBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (revealedPasswords.has(pw.id)) {
        revealedPasswords.delete(pw.id);
      } else {
        revealedPasswords.add(pw.id);
      }
      renderPasswords();
    });
  }

  // Copy Password
  const copyPwdBtn = el.querySelector('.copy-pwd-btn');
  if (copyPwdBtn) {
    copyPwdBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(pw.password || '').then(() => {
        showToast('Password copied to clipboard ✓ (Auto-clears in 30s)');
        setTimeout(() => {
          navigator.clipboard.writeText('').catch(() => {});
        }, 30000);
      }).catch(() => showToast('Failed to copy password'));
    });
  }

  // Copy Username
  const copyUserBtn = el.querySelector('.copy-user-btn');
  if (copyUserBtn) {
    copyUserBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(pw.username || '').then(() => {
        showToast('Username copied ✓');
      }).catch(() => showToast('Failed to copy username'));
    });
  }

  // Open URL
  const openBtn = el.querySelector('.open-btn');
  if (openBtn) {
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (pw.url) {
        const url = pw.url.startsWith('http') ? pw.url : 'https://' + pw.url;
        window.open(url, '_blank');
      } else {
        showToast('No URL saved for this entry');
      }
    });
  }

  // Edit
  const editBtn = el.querySelector('.edit-btn');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(pw);
    });
  }

  // Delete
  const delBtn = el.querySelector('.delete-btn');
  if (delBtn) {
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete password entry for "${pw.title}"?`)) {
        passwords = passwords.filter(p => p.id !== pw.id);
        revealedPasswords.delete(pw.id);
        renderAll();
        showToast('Password deleted');
        try { await apiRequest(`/api/passwords/${pw.id}`, 'DELETE'); } catch (err) { console.error(err); }
      }
    });
  }

  // Star Toggle
  const starBtn = el.querySelector('.star-btn');
  if (starBtn) {
    starBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const entry = passwords.find(p => p.id === pw.id);
      if (entry) {
        entry.starred = !entry.starred;
        renderAll();
        try { await apiRequest(`/api/passwords/${pw.id}`, 'PUT', { starred: entry.starred }); } catch (err) { console.error(err); }
      }
    });
  }

  // Double click on card row opens Edit Modal
  el.addEventListener('dblclick', (e) => {
    if (e.target.closest('.pm-card-actions') || e.target.closest('.col-actions') || e.target.closest('button')) return;
    openEditModal(pw);
  });
}

// ── Master Render ───────────────────────────────────────────────────────────

function renderAll() {
  renderCategories();
  renderBrowserChips();
  renderStrengthStats();
  renderPasswords();
  updateCategorySelect();
}

// ── Category Select in Modal ────────────────────────────────────────────────

function updateCategorySelect() {
  if (!pmFormCategory) return;
  const cats = getCategories();
  const names = Object.keys(cats).sort();
  const prev = pmFormCategory.value;
  pmFormCategory.innerHTML = '';

  const allNames = new Set(['General', 'Social', 'Email', 'Banking', 'Shopping', 'Work', 'Entertainment', 'Gaming', 'Developer', ...names]);
  allNames.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${getCategoryIcon(name)} ${name}`;
    pmFormCategory.appendChild(opt);
  });
  if ([...allNames].includes(prev)) pmFormCategory.value = prev;
}

// ── Add / Edit Modal ────────────────────────────────────────────────────────

function openAddModal() {
  formTags = [];
  pmFormId.value = '';
  pmForm.reset();
  pmModalTitle.textContent = 'Add Password';
  deletePmBtn.style.display = 'none';
  if (importedMetaWrap) importedMetaWrap.style.display = 'none';
  renderTagPills();
  updateCategorySelect();
  applyStrengthToBar(formStrengthBar, formStrengthLabel, { pct: 0, label: '', color: '' });
  if (activeCategory && !activeCategory.startsWith('__') && pmFormCategory) {
    pmFormCategory.value = activeCategory;
  }
  openModal(passwordModal);
  pmFormTitle.focus();
}

function openEditModal(pw) {
  formTags = [...(pw.tags || [])];
  pmFormId.value = pw.id;
  pmFormTitle.value = pw.title || '';
  pmFormUrl.value = pw.url || '';
  pmFormUsername.value = pw.username || '';
  pmFormPassword.value = pw.password || '';
  pmFormNotes.value = pw.notes || '';
  pmModalTitle.textContent = 'Edit Password';
  deletePmBtn.style.display = 'inline-flex';
  updateCategorySelect();
  if (pmFormCategory && pw.category) pmFormCategory.value = pw.category;
  renderTagPills();

  if (importedMetaWrap && importedMetaBadge) {
    if (pw.browserSource) {
      importedMetaWrap.style.display = 'block';
      importedMetaBadge.innerHTML = `${BROWSER_ICONS[pw.browserSource] || ''} ${escapeHtml(pw.browserSource)} (${escapeHtml(pw.profileName || 'Default')})`;
    } else {
      importedMetaWrap.style.display = 'none';
    }
  }

  const s = analyzeStrength(pw.password);
  applyStrengthToBar(formStrengthBar, formStrengthLabel, s);
  openModal(passwordModal);
  pmFormTitle.focus();
}

function openModal(modal) {
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// ── Tags ────────────────────────────────────────────────────────────────────

function renderTagPills() {
  if (!pmTagsList) return;
  pmTagsList.innerHTML = '';
  formTags.forEach((tag, i) => {
    const pill = document.createElement('span');
    pill.className = 'pm-tag-pill';
    pill.innerHTML = `${escapeHtml(tag)} <button type="button" class="pm-tag-remove" data-i="${i}">&times;</button>`;
    pill.querySelector('.pm-tag-remove').addEventListener('click', () => {
      formTags.splice(i, 1);
      renderTagPills();
    });
    pmTagsList.appendChild(pill);
  });
}

// ── Password Generator ──────────────────────────────────────────────────────

function generatePassword() {
  const len = parseInt(genLength?.value) || 16;
  const useUpper = genUpper?.checked ?? true;
  const useLower = genLower?.checked ?? true;
  const useNums = genNumbers?.checked ?? true;
  const useSymbols = genSymbols?.checked ?? true;
  const excludeAmbig = genExcludeAmbiguous?.checked ?? false;

  let upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let lower = 'abcdefghijklmnopqrstuvwxyz';
  let nums = '0123456789';
  const syms = '!@#$%^&*()-_=+[]{}|;:,.<>?';

  if (excludeAmbig) {
    upper = upper.replace(/[OI]/g, '');
    lower = lower.replace(/[l]/g, '');
    nums = nums.replace(/[01]/g, '');
  }

  let charset = '';
  const required = [];

  if (useUpper)   { charset += upper; required.push(upper[Math.floor(Math.random() * upper.length)]); }
  if (useLower)   { charset += lower; required.push(lower[Math.floor(Math.random() * lower.length)]); }
  if (useNums)    { charset += nums;  required.push(nums[Math.floor(Math.random() * nums.length)]); }
  if (useSymbols) { charset += syms;  required.push(syms[Math.floor(Math.random() * syms.length)]); }

  if (!charset) { charset = lower; required.push(lower[0]); }

  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);

  let pwd = required.join('');
  for (let i = required.length; i < len; i++) {
    pwd += charset[arr[i] % charset.length];
  }

  const pwdArr = pwd.split('');
  const shuffleArr = new Uint32Array(pwdArr.length);
  crypto.getRandomValues(shuffleArr);
  for (let i = pwdArr.length - 1; i > 0; i--) {
    const j = shuffleArr[i] % (i + 1);
    [pwdArr[i], pwdArr[j]] = [pwdArr[j], pwdArr[i]];
  }

  return pwdArr.join('');
}

function updateGeneratorUI() {
  const pwd = generatePassword();
  generatedPasswordBuffer = pwd;
  if (genPwdOutput) genPwdOutput.textContent = pwd;
  const s = analyzeStrength(pwd);
  applyStrengthToBar(genStrengthBar, genStrengthLabel, s);
}

// ── Profile Sync / Fetch ────────────────────────────────────────────────────

async function handleFetchProfiles() {
  const icon = syncProfilesBtn?.querySelector('.sync-icon');
  if (icon) icon.classList.add('spinning');
  showToast('Scanning browser profiles for saved logins...');

  try {
    const res = await apiRequest('/api/passwords/sync', 'POST');
    if (res.addedCount > 0) {
      showToast(`Imported ${res.addedCount} new password(s) across browser profiles!`);
    } else {
      showToast('All browser profile logins are up to date ✓');
    }
    // Refresh local list
    const updated = await apiRequest('/api/passwords');
    passwords = updated || [];
    renderAll();
  } catch (err) {
    console.error('Fetch error:', err);
    showToast('Failed to fetch from browser profiles');
  } finally {
    if (icon) icon.classList.remove('spinning');
  }
}

// ── Export ──────────────────────────────────────────────────────────────────

function handleExport() {
  if (passwords.length === 0) {
    showToast('No passwords to export');
    return;
  }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(passwords, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `passwords_export_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast(`Exported ${passwords.length} password(s) ✓`);
}

// ── Setup Event Listeners ───────────────────────────────────────────────────

function setupEventListeners() {
  addPasswordBtn?.addEventListener('click', openAddModal);
  emptyAddBtn?.addEventListener('click', openAddModal);
  syncProfilesBtn?.addEventListener('click', handleFetchProfiles);
  emptySyncBtn?.addEventListener('click', handleFetchProfiles);
  exportBtn?.addEventListener('click', handleExport);
  themeToggleBtn?.addEventListener('click', toggleTheme);

  addCategoryBtn?.addEventListener('click', () => {
    const name = prompt('New category name:');
    if (name && name.trim()) {
      const trimmed = name.trim();
      openAddModal();
      if (pmFormCategory) {
        const opt = document.createElement('option');
        opt.value = trimmed;
        opt.textContent = `${getCategoryIcon(trimmed)} ${trimmed}`;
        pmFormCategory.appendChild(opt);
        pmFormCategory.value = trimmed;
      }
    }
  });

  // Search
  pmSearch?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    pmSearchClear.style.display = searchQuery ? 'flex' : 'none';
    renderPasswords();
  });

  pmSearchClear?.addEventListener('click', () => {
    pmSearch.value = '';
    searchQuery = '';
    pmSearchClear.style.display = 'none';
    renderPasswords();
    pmSearch.focus();
  });

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      pmSearch?.focus();
    }
    if (e.key === 'Escape') {
      if (passwordModal?.style.display === 'flex') closeModal(passwordModal);
      if (renameCatModal?.style.display === 'flex') closeModal(renameCatModal);
      if (generatorModal?.style.display === 'flex') closeModal(generatorModal);
      if (searchQuery) {
        pmSearch.value = '';
        searchQuery = '';
        pmSearchClear.style.display = 'none';
        renderPasswords();
      }
    }
  });

  // View Switcher
  document.querySelectorAll('.pm-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pm-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderPasswords();
    });
  });

  // Sort
  pmSortSelect?.addEventListener('change', () => {
    currentSort = pmSortSelect.value;
    renderPasswords();
  });

  // Category Actions
  renameCategoryBtn?.addEventListener('click', () => {
    if (!activeCategory || activeCategory.startsWith('__')) return;
    renameCatInput.value = activeCategory;
    openModal(renameCatModal);
    renameCatInput.focus();
  });

  deleteCategoryBtn?.addEventListener('click', async () => {
    if (!activeCategory || activeCategory.startsWith('__')) return;
    const catName = activeCategory;
    if (!confirm(`Delete category "${catName}" and remove its passwords?`)) return;
    passwords = passwords.filter(p => (p.category || 'General') !== catName);
    activeCategory = null;
    renderAll();
    showToast('Category deleted');
    try { await apiRequest(`/api/passwords/categories/${encodeURIComponent(catName)}`, 'DELETE'); } catch (err) { console.error(err); }
  });

  crumbRoot?.addEventListener('click', () => {
    activeCategory = null;
    activeBrowserFilter = null;
    renderAll();
  });

  // Password Form Modal
  closePmModal?.addEventListener('click', () => closeModal(passwordModal));
  cancelPmModal?.addEventListener('click', () => closeModal(passwordModal));
  passwordModal?.addEventListener('click', (e) => {
    if (e.target === passwordModal) closeModal(passwordModal);
  });

  pmToggleFormPwd?.addEventListener('click', () => {
    const isPassword = pmFormPassword.type === 'password';
    pmFormPassword.type = isPassword ? 'text' : 'password';
    pmToggleFormPwd.querySelector('.eye-show').style.display = isPassword ? 'none' : '';
    pmToggleFormPwd.querySelector('.eye-hide').style.display = isPassword ? '' : 'none';
  });

  pmFormPassword?.addEventListener('input', () => {
    const s = analyzeStrength(pmFormPassword.value);
    applyStrengthToBar(formStrengthBar, formStrengthLabel, s);
  });

  pmGenerateInline?.addEventListener('click', () => {
    const pwd = generatePassword();
    pmFormPassword.value = pwd;
    pmFormPassword.type = 'text';
    pmToggleFormPwd.querySelector('.eye-show').style.display = 'none';
    pmToggleFormPwd.querySelector('.eye-hide').style.display = '';
    const s = analyzeStrength(pwd);
    applyStrengthToBar(formStrengthBar, formStrengthLabel, s);
    showToast('Strong password generated ✓');
  });

  pmFormTagsInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const tag = pmFormTagsInput.value.trim();
      if (tag && !formTags.includes(tag) && formTags.length < 8) {
        formTags.push(tag);
        pmFormTagsInput.value = '';
        renderTagPills();
      }
    }
  });

  pmNewCatInline?.addEventListener('click', () => {
    const name = prompt('New category name:');
    if (name && name.trim()) {
      const opt = document.createElement('option');
      opt.value = name.trim();
      opt.textContent = `${getCategoryIcon(name.trim())} ${name.trim()}`;
      pmFormCategory.appendChild(opt);
      pmFormCategory.value = name.trim();
    }
  });

  pmForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = pmFormId.value;
    const payload = {
      title: pmFormTitle.value.trim(),
      url: pmFormUrl.value.trim(),
      username: pmFormUsername.value.trim(),
      password: pmFormPassword.value,
      category: pmFormCategory.value || 'General',
      notes: pmFormNotes.value.trim(),
      tags: [...formTags],
    };

    if (!payload.title || !payload.password) {
      showToast('Title and password are required');
      return;
    }

    closeModal(passwordModal);

    if (id) {
      payload.updatedAt = Date.now();
      const idx = passwords.findIndex(p => p.id === id);
      if (idx !== -1) passwords[idx] = { ...passwords[idx], ...payload };
      renderAll();
      showToast('Password updated ✓');
      try { await apiRequest(`/api/passwords/${id}`, 'PUT', payload); } catch (err) { console.error(err); }
    } else {
      const tempId = 'pw-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
      const newEntry = { id: tempId, ...payload, createdAt: Date.now(), updatedAt: Date.now() };
      passwords.unshift(newEntry);
      renderAll();
      showToast('Password saved ✓');
      try {
        const saved = await apiRequest('/api/passwords', 'POST', payload);
        const i = passwords.findIndex(p => p.id === tempId);
        if (i !== -1) passwords[i].id = saved.id;
      } catch (err) { console.error(err); }
    }
  });

  deletePmBtn?.addEventListener('click', async () => {
    const id = pmFormId.value;
    if (!id) return;
    const entry = passwords.find(p => p.id === id);
    if (!confirm(`Delete password for "${entry?.title}"?`)) return;
    closeModal(passwordModal);
    passwords = passwords.filter(p => p.id !== id);
    revealedPasswords.delete(id);
    renderAll();
    showToast('Password deleted');
    try { await apiRequest(`/api/passwords/${id}`, 'DELETE'); } catch (err) { console.error(err); }
  });

  // Rename Category Form
  closeRenameCatModal?.addEventListener('click', () => closeModal(renameCatModal));
  cancelRenameCatModal?.addEventListener('click', () => closeModal(renameCatModal));
  renameCatModal?.addEventListener('click', (e) => {
    if (e.target === renameCatModal) closeModal(renameCatModal);
  });

  renameCatForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldName = activeCategory;
    const newName = renameCatInput.value.trim();
    if (!newName || !oldName || oldName.startsWith('__')) return;
    closeModal(renameCatModal);
    passwords.forEach(p => {
      if ((p.category || 'General') === oldName) p.category = newName;
    });
    activeCategory = newName;
    renderAll();
    showToast(`Category renamed to "${newName}"`);
    try { await apiRequest('/api/passwords/categories/rename', 'PUT', { oldName, newName }); } catch (err) { console.error(err); }
  });

  // Generator Modal
  openGeneratorBtn?.addEventListener('click', () => {
    openModal(generatorModal);
    updateGeneratorUI();
  });

  closeGeneratorModal?.addEventListener('click', () => closeModal(generatorModal));
  generatorModal?.addEventListener('click', (e) => {
    if (e.target === generatorModal) closeModal(generatorModal);
  });

  genLength?.addEventListener('input', () => {
    genLengthVal.textContent = genLength.value;
    updateGeneratorUI();
  });

  [genUpper, genLower, genNumbers, genSymbols, genExcludeAmbiguous].forEach(el => {
    el?.addEventListener('change', updateGeneratorUI);
  });

  genRefreshBtn?.addEventListener('click', updateGeneratorUI);

  genCopyBtn?.addEventListener('click', () => {
    if (!generatedPasswordBuffer) return;
    navigator.clipboard.writeText(generatedPasswordBuffer).then(() => {
      showToast('Password copied ✓');
    }).catch(() => showToast('Failed to copy'));
  });

  genUseBtn?.addEventListener('click', () => {
    if (!generatedPasswordBuffer) return;
    closeModal(generatorModal);
    openAddModal();
    pmFormPassword.value = generatedPasswordBuffer;
    pmFormPassword.type = 'text';
    if (pmToggleFormPwd) {
      pmToggleFormPwd.querySelector('.eye-show').style.display = 'none';
      pmToggleFormPwd.querySelector('.eye-hide').style.display = '';
    }
    const s = analyzeStrength(generatedPasswordBuffer);
    applyStrengthToBar(formStrengthBar, formStrengthLabel, s);
    showToast('Password inserted into form ✓');
  });
}

// ── Initialization ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initDOMElements();
  setupEventListeners();
  setupSSE();
});
