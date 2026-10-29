/**
 * Browser Home Page - Multi-Browser Synchronized Dashboard
 */

// Unique Client ID for this browser tab/session
const CLIENT_ID = 'client-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

// Search Engines Configuration
const SEARCH_ENGINES = {
  google: {
    id: 'google',
    name: 'Google',
    icon: '🌐',
    url: 'https://www.google.com/search?q='
  },
  duckduckgo: {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    icon: '🦆',
    url: 'https://duckduckgo.com/?q='
  },
  bing: {
    id: 'bing',
    name: 'Bing',
    icon: '🅱️',
    url: 'https://www.bing.com/search?q='
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    icon: '▶️',
    url: 'https://www.youtube.com/results?search_query='
  },
  github: {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    url: 'https://github.com/search?q='
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    icon: '🤖',
    url: 'https://www.reddit.com/search/?q='
  },
  wikipedia: {
    id: 'wikipedia',
    name: 'Wikipedia',
    icon: '📚',
    url: 'https://en.wikipedia.org/wiki/Special:Search?search='
  },
  brave: {
    id: 'brave',
    name: 'Brave',
    icon: '🦁',
    url: 'https://search.brave.com/search?q='
  }
};

// Global State
let state = {
  settings: {
    theme: 'dark',
    activeSearchEngine: 'google',
    sortByVisits: true
  },
  sites: [],
  todos: [],
  notes: []
};

let activeTodoFilter = 'all';
let focusedNoteId = null;
const noteDebounceTimers = {};

// DOM Elements (only fetched in browser environment)
let greetingTime, greetingText, greetingDate, syncStatus, syncLabel, themeToggleBtn, helpBtn;
let searchForm, searchInput, clearSearchBtn, activeEngineBtn, activeEngineIcon, activeEngineName, engineDropdown, engineChips;
let sitesGrid, sitesCountBadge, toggleSortBtn, sortOrderLabel, addSiteBtn;
let siteModal, siteForm, modalSiteTitle, siteFormId, siteFormTitle, siteFormUrl, siteFormPinned, deleteSiteModalBtn, closeSiteModalBtn, cancelSiteModalBtn;
let addTodoForm, todoInput, todoList, todoEmptyState, todoPendingBadge, filterTabs;
let notesBoard, notesCountBadge, addNoteBtn;
let helpModal, closeHelpModalBtn, okHelpModalBtn, serverAddressCode;

function initDOMElements() {
  if (typeof document === 'undefined') return;

  greetingTime = document.getElementById('greetingTime');
  greetingText = document.getElementById('greetingText');
  greetingDate = document.getElementById('greetingDate');
  syncStatus = document.getElementById('syncStatus');
  syncLabel = document.getElementById('syncLabel');
  themeToggleBtn = document.getElementById('themeToggleBtn');
  helpBtn = document.getElementById('helpBtn');

  searchForm = document.getElementById('searchForm');
  searchInput = document.getElementById('searchInput');
  clearSearchBtn = document.getElementById('clearSearchBtn');
  activeEngineBtn = document.getElementById('activeEngineBtn');
  activeEngineIcon = document.getElementById('activeEngineIcon');
  activeEngineName = document.getElementById('activeEngineName');
  engineDropdown = document.getElementById('engineDropdown');
  engineChips = document.getElementById('engineChips');

  sitesGrid = document.getElementById('sitesGrid');
  sitesCountBadge = document.getElementById('sitesCountBadge');
  toggleSortBtn = document.getElementById('toggleSortBtn');
  sortOrderLabel = document.getElementById('sortOrderLabel');
  addSiteBtn = document.getElementById('addSiteBtn');

  siteModal = document.getElementById('siteModal');
  siteForm = document.getElementById('siteForm');
  modalSiteTitle = document.getElementById('modalSiteTitle');
  siteFormId = document.getElementById('siteFormId');
  siteFormTitle = document.getElementById('siteFormTitle');
  siteFormUrl = document.getElementById('siteFormUrl');
  siteFormPinned = document.getElementById('siteFormPinned');
  deleteSiteModalBtn = document.getElementById('deleteSiteModalBtn');
  closeSiteModalBtn = document.getElementById('closeSiteModalBtn');
  cancelSiteModalBtn = document.getElementById('cancelSiteModalBtn');

  addTodoForm = document.getElementById('addTodoForm');
  todoInput = document.getElementById('todoInput');
  todoList = document.getElementById('todoList');
  todoEmptyState = document.getElementById('todoEmptyState');
  todoPendingBadge = document.getElementById('todoPendingBadge');
  filterTabs = document.querySelectorAll('.filter-tab');

  notesBoard = document.getElementById('notesBoard');
  notesCountBadge = document.getElementById('notesCountBadge');
  addNoteBtn = document.getElementById('addNoteBtn');

  helpModal = document.getElementById('helpModal');
  closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
  okHelpModalBtn = document.getElementById('okHelpModalBtn');
  serverAddressCode = document.getElementById('serverAddressCode');
}

/* ========================================================
   API Helper Functions
   ======================================================== */
async function apiRequest(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-ID': CLIENT_ID
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(endpoint, options);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('API request failed:', endpoint, err);
    throw err;
  }
}

/* ========================================================
   Server-Sent Events (Real-time Cross-Browser Sync)
   ======================================================== */
function setupRealtimeSync() {
  if (typeof EventSource === 'undefined') return;
  const evtSource = new EventSource('/api/events');

  evtSource.onopen = () => {
    if (syncStatus) syncStatus.className = 'sync-status connected';
    if (syncLabel) syncLabel.textContent = 'Synced • Live';
  };

  evtSource.onerror = () => {
    if (syncStatus) syncStatus.className = 'sync-status disconnected';
    if (syncLabel) syncLabel.textContent = 'Reconnecting...';
  };

  evtSource.addEventListener('init', (e) => {
    try {
      const data = JSON.parse(e.data);
      state = data;
      renderAll();
    } catch (err) {
      console.error('Failed to parse init data:', err);
    }
  });

  evtSource.addEventListener('settings_updated', (e) => {
    try {
      const { settings } = JSON.parse(e.data);
      state.settings = settings;
      applyTheme(state.settings.theme);
      updateClock();
      selectSearchEngine(state.settings.activeSearchEngine || 'google', false);
      updateSortButtonUI();
      renderSites();
    } catch (err) {
      console.error(err);
    }
  });

  evtSource.addEventListener('sites_updated', (e) => {
    try {
      const { sites } = JSON.parse(e.data);
      state.sites = sites;
      renderSites();
    } catch (err) {
      console.error(err);
    }
  });

  evtSource.addEventListener('todos_updated', (e) => {
    try {
      const { todos } = JSON.parse(e.data);
      state.todos = todos;
      renderTodos();
    } catch (err) {
      console.error(err);
    }
  });

  evtSource.addEventListener('notes_updated', (e) => {
    try {
      const payload = JSON.parse(e.data);
      state.notes = payload.notes;
      renderNotes(payload.originClientId);
    } catch (err) {
      console.error(err);
    }
  });
}

/* ========================================================
   Clock and Greetings
   ======================================================== */
function updateClock() {
  if (!greetingTime || !greetingText || !greetingDate) return;
  const now = new Date();
  
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  greetingTime.textContent = `${displayHours}:${minutes} ${ampm}`;

  let greeting = 'Good evening';
  if (hours >= 5 && hours < 12) greeting = 'Good morning';
  else if (hours >= 12 && hours < 17) greeting = 'Good afternoon';
  else if (hours >= 22 || hours < 5) greeting = 'Good night';
  
  const name = state.settings.userName || 'Explorer';
  greetingText.textContent = `${greeting}, ${name}`;

  const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
  greetingDate.textContent = now.toLocaleDateString(undefined, options);
}

/* ========================================================
   Theme Toggle
   ======================================================== */
function applyTheme(theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  state.settings.theme = next;
  apiRequest('/api/settings', 'PUT', { theme: next });
}

/* ========================================================
   Search Engines & Form Handling
   ======================================================== */
function renderSearchEngines() {
  if (!engineDropdown || !engineChips) return;
  engineDropdown.innerHTML = '';
  engineChips.innerHTML = '';

  Object.values(SEARCH_ENGINES).forEach(eng => {
    const optBtn = document.createElement('button');
    optBtn.type = 'button';
    optBtn.className = `engine-option ${state.settings.activeSearchEngine === eng.id ? 'active' : ''}`;
    optBtn.innerHTML = `<span>${eng.icon}</span> <span>${eng.name}</span>`;
    optBtn.addEventListener('click', () => {
      selectSearchEngine(eng.id, true);
      engineDropdown.classList.remove('open');
      searchInput.focus();
    });
    engineDropdown.appendChild(optBtn);

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `engine-chip ${state.settings.activeSearchEngine === eng.id ? 'active' : ''}`;
    chip.innerHTML = `<span>${eng.icon}</span> <span>${eng.name}</span>`;
    chip.addEventListener('click', () => {
      selectSearchEngine(eng.id, true);
      // UX improvement: If search box has query, execute immediately!
      if (searchInput.value.trim()) {
        handleSearch(searchInput.value);
      } else {
        searchInput.focus();
      }
    });
    engineChips.appendChild(chip);
  });
}

function selectSearchEngine(engineId, persist = false) {
  const engine = SEARCH_ENGINES[engineId] || SEARCH_ENGINES.google;
  state.settings.activeSearchEngine = engine.id;
  if (activeEngineIcon) activeEngineIcon.textContent = engine.icon;
  if (activeEngineName) activeEngineName.textContent = engine.name;
  if (searchInput) searchInput.placeholder = `Search with ${engine.name} or type URL...`;

  if (typeof document !== 'undefined') {
    document.querySelectorAll('.engine-option').forEach(el => {
      el.classList.toggle('active', el.textContent.includes(engine.name));
    });
    document.querySelectorAll('.engine-chip').forEach(el => {
      el.classList.toggle('active', el.textContent.includes(engine.name));
    });
  }

  if (persist) {
    apiRequest('/api/settings', 'PUT', { activeSearchEngine: engine.id });
  }
}

/**
 * Pure helper to compute target URL for search queries or direct URLs
 */
function resolveSearchTarget(query, currentEngineId = 'google') {
  if (!query) return null;
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Shortcut prefixes: !g, !d, !y, !gh, !r, !w, !br, etc.
  const prefixMatch = trimmed.match(/^!([a-z]+)\s+(.+)$/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toLowerCase();
    const actualQuery = prefixMatch[2];
    const prefixMap = {
      g: 'google',
      d: 'duckduckgo',
      ddg: 'duckduckgo',
      b: 'bing',
      y: 'youtube',
      yt: 'youtube',
      gh: 'github',
      r: 'reddit',
      w: 'wikipedia',
      wiki: 'wikipedia',
      br: 'brave'
    };
    if (prefixMap[prefix]) {
      const eng = SEARCH_ENGINES[prefixMap[prefix]];
      return eng.url + encodeURIComponent(actualQuery);
    }
  }

  // Detect direct URLs (e.g. github.com, localhost:3000, https://...)
  const isUrl = /^(https?:\/\/|[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$|localhost(:[0-9]+)?(\/.*)?)/i.test(trimmed);
  if (isUrl && !trimmed.includes(' ')) {
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  }

  // Standard search
  const activeEngine = SEARCH_ENGINES[currentEngineId] || SEARCH_ENGINES.google;
  return activeEngine.url + encodeURIComponent(trimmed);
}

function handleSearch(query) {
  const target = resolveSearchTarget(query, state.settings.activeSearchEngine);
  if (target && typeof window !== 'undefined') {
    window.open(target, '_blank');
  }
}

/* ========================================================
   Most Visited Sites
   ======================================================== */
function getSortedSites(sitesList = state.sites, sortByVisits = state.settings.sortByVisits) {
  const sites = [...(sitesList || [])];
  if (sortByVisits) {
    return sites.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return (b.visits || 0) - (a.visits || 0);
    });
  }
  return sites;
}

function updateSortButtonUI() {
  if (sortOrderLabel) {
    sortOrderLabel.textContent = state.settings.sortByVisits ? 'Sort: Visits' : 'Sort: Default';
  }
}

function renderSites() {
  if (!sitesGrid || !sitesCountBadge) return;
  const sorted = getSortedSites();
  sitesCountBadge.textContent = sorted.length;
  sitesGrid.innerHTML = '';

  sorted.forEach(site => {
    const card = document.createElement('div');
    card.className = 'site-card';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');

    let domain = '';
    try {
      domain = new URL(site.url).hostname;
    } catch (e) {
      domain = site.url.replace(/^https?:\/\//, '').split('/')[0];
    }
    const faviconUrl = `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
    const initial = (site.title || 'W')[0].toUpperCase();

    card.innerHTML = `
      ${site.pinned ? `<span class="site-pin-badge" title="Pinned to top">📌</span>` : ''}
      <button class="site-card-menu" title="Edit or Remove">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="19" cy="12" r="1"></circle>
          <circle cx="5" cy="12" r="1"></circle>
        </svg>
      </button>
      <div class="site-icon-wrapper">
        <img class="site-favicon" src="${faviconUrl}" alt="${site.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
        <span class="site-fallback-avatar" style="display:none;">${initial}</span>
      </div>
      <span class="site-title" title="${escapeHtml(site.title)}">${escapeHtml(site.title)}</span>
      <span class="site-visits" title="${site.visits || 0} visits">
        🔥 ${site.visits || 0}
      </span>
    `;

    // Navigate handler with middle-click / Ctrl-click support
    const handleNavigate = (e) => {
      if (e.target.closest('.site-card-menu')) return;
      
      // Increment visit counter on server
      apiRequest(`/api/sites/${site.id}/visit`, 'POST').catch(console.error);

      // Open in new tab if Ctrl, Cmd, or Middle-click pressed
      if (e.ctrlKey || e.metaKey || e.button === 1) {
        window.open(site.url, '_blank');
      } else {
        window.open(site.url, '_blank');
      }
    };

    card.addEventListener('click', handleNavigate);
    card.addEventListener('auxclick', handleNavigate);

    // Keyboard navigation (Enter key)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleNavigate(e);
    });

    // 3-dot menu click
    const menuBtn = card.querySelector('.site-card-menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSiteEditModal(site);
    });

    sitesGrid.appendChild(card);
  });
}

function openSiteEditModal(site = null) {
  if (!siteModal) return;
  if (site) {
    modalSiteTitle.textContent = 'Edit Quick Link';
    siteFormId.value = site.id;
    siteFormTitle.value = site.title;
    siteFormUrl.value = site.url;
    siteFormPinned.checked = !!site.pinned;
    if (deleteSiteModalBtn) deleteSiteModalBtn.style.display = 'inline-flex';
  } else {
    modalSiteTitle.textContent = 'Add Quick Link';
    siteFormId.value = '';
    siteFormTitle.value = '';
    siteFormUrl.value = '';
    siteFormPinned.checked = false;
    if (deleteSiteModalBtn) deleteSiteModalBtn.style.display = 'none';
  }
  siteModal.style.display = 'flex';
  siteFormTitle.focus();
}

function closeSiteModal() {
  if (siteModal) siteModal.style.display = 'none';
}

/* ========================================================
   To-Do List
   ======================================================== */
function renderTodos() {
  if (!todoList || !todoPendingBadge || !todoEmptyState) return;
  const todos = state.todos || [];
  const activeCount = todos.filter(t => !t.completed).length;
  todoPendingBadge.textContent = `${activeCount} pending`;

  const filtered = todos.filter(t => {
    if (activeTodoFilter === 'active') return !t.completed;
    if (activeTodoFilter === 'completed') return t.completed;
    return true;
  });

  todoList.innerHTML = '';
  if (filtered.length === 0) {
    todoEmptyState.style.display = 'block';
  } else {
    todoEmptyState.style.display = 'none';
    filtered.forEach(todo => {
      const li = document.createElement('li');
      li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      li.innerHTML = `
        <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} aria-label="Mark task complete" />
        <span class="todo-text" title="Double click to edit">${escapeHtml(todo.text)}</span>
        <button class="todo-delete-btn" title="Delete Task" aria-label="Delete Task">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;

      // Checkbox toggle
      const cb = li.querySelector('.todo-checkbox');
      cb.addEventListener('change', () => {
        todo.completed = cb.checked;
        li.classList.toggle('completed', todo.completed);
        const count = (state.todos || []).filter(t => !t.completed).length;
        todoPendingBadge.textContent = `${count} pending`;
        apiRequest(`/api/todos/${todo.id}`, 'PUT', { completed: todo.completed });
      });

      // Double-click to edit todo text
      const todoTextSpan = li.querySelector('.todo-text');
      todoTextSpan.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.value = todo.text;
        input.style.padding = '4px 8px';
        input.style.fontSize = '0.88rem';
        todoTextSpan.replaceWith(input);
        input.focus();

        const saveEdit = () => {
          const newText = input.value.trim();
          if (newText && newText !== todo.text) {
            todo.text = newText;
            apiRequest(`/api/todos/${todo.id}`, 'PUT', { text: newText });
          }
          renderTodos();
        };

        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') saveEdit();
          if (e.key === 'Escape') renderTodos();
        });
      });

      // Delete button
      const delBtn = li.querySelector('.todo-delete-btn');
      delBtn.addEventListener('click', () => {
        state.todos = state.todos.filter(t => t.id !== todo.id);
        renderTodos();
        apiRequest(`/api/todos/${todo.id}`, 'DELETE');
      });

      todoList.appendChild(li);
    });
  }
}

/* ========================================================
   Sticky Notes (With In-Place Concurrent Reconciliation)
   ======================================================== */
function createNoteElement(note) {
  const card = document.createElement('div');
  card.className = `sticky-note note-${note.color || 'yellow'}`;
  card.dataset.id = note.id;

  card.innerHTML = `
    <div class="note-header">
      <input type="text" class="note-title-input" value="${escapeHtml(note.title || '')}" placeholder="Note Title" />
      <div class="note-actions">
        <div class="note-color-picker">
          <span class="color-dot dot-yellow" data-color="yellow" title="Yellow"></span>
          <span class="color-dot dot-mint" data-color="mint" title="Mint"></span>
          <span class="color-dot dot-pink" data-color="pink" title="Pink"></span>
          <span class="color-dot dot-blue" data-color="blue" title="Blue"></span>
          <span class="color-dot dot-lavender" data-color="lavender" title="Lavender"></span>
          <span class="color-dot dot-dark" data-color="dark" title="Dark"></span>
        </div>
        <button class="note-delete-btn" title="Delete Note">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <textarea class="note-content-area" placeholder="Write anything...">${escapeHtml(note.content || '')}</textarea>
    <div class="note-footer">
      <span class="note-sync-indicator" id="sync-${note.id}">Saved</span>
    </div>
  `;

  const titleInput = card.querySelector('.note-title-input');
  const contentArea = card.querySelector('.note-content-area');
  const deleteBtn = card.querySelector('.note-delete-btn');
  const colorDots = card.querySelectorAll('.color-dot');
  const syncIndicator = card.querySelector(`#sync-${note.id}`);

  const triggerSave = () => {
    syncIndicator.textContent = 'Syncing...';
    clearTimeout(noteDebounceTimers[note.id]);
    noteDebounceTimers[note.id] = setTimeout(() => {
      note.title = titleInput.value;
      note.content = contentArea.value;
      apiRequest(`/api/notes/${note.id}`, 'PUT', {
        title: note.title,
        content: note.content
      }).then(() => {
        syncIndicator.textContent = 'Synced';
      });
    }, 400);
  };

  titleInput.addEventListener('input', triggerSave);
  contentArea.addEventListener('input', triggerSave);

  titleInput.addEventListener('focus', () => { focusedNoteId = note.id; });
  titleInput.addEventListener('blur', () => { if (focusedNoteId === note.id) focusedNoteId = null; });
  contentArea.addEventListener('focus', () => { focusedNoteId = note.id; });
  contentArea.addEventListener('blur', () => { if (focusedNoteId === note.id) focusedNoteId = null; });

  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const newColor = dot.dataset.color;
      card.className = `sticky-note note-${newColor}`;
      note.color = newColor;
      apiRequest(`/api/notes/${note.id}`, 'PUT', { color: newColor });
    });
  });

  deleteBtn.addEventListener('click', () => {
    state.notes = state.notes.filter(n => n.id !== note.id);
    card.remove();
    if (notesCountBadge) notesCountBadge.textContent = state.notes.length;
    apiRequest(`/api/notes/${note.id}`, 'DELETE');
  });

  return card;
}

function renderNotes(originClientId = null) {
  if (!notesBoard || !notesCountBadge) return;
  const notes = state.notes || [];
  notesCountBadge.textContent = notes.length;

  const currentIds = new Set(notes.map(n => n.id));

  // 1. Remove deleted cards from DOM
  const existingCards = notesBoard.querySelectorAll('.sticky-note');
  existingCards.forEach(card => {
    if (!currentIds.has(card.dataset.id)) {
      card.remove();
    }
  });

  // 2. Reconcile existing cards or append new ones
  notes.forEach(note => {
    let card = notesBoard.querySelector(`.sticky-note[data-id="${note.id}"]`);

    if (!card) {
      // New note: create and append
      card = createNoteElement(note);
      notesBoard.appendChild(card);
    } else {
      // Existing note: in-place update without interrupting active focus
      const isFocused = focusedNoteId === note.id;

      // Update color class
      card.className = `sticky-note note-${note.color || 'yellow'}`;

      const titleInput = card.querySelector('.note-title-input');
      const contentArea = card.querySelector('.note-content-area');

      // Only update values if user is NOT currently typing in this note!
      if (!isFocused) {
        if (titleInput && titleInput.value !== (note.title || '')) {
          titleInput.value = note.title || '';
        }
        if (contentArea && contentArea.value !== (note.content || '')) {
          contentArea.value = note.content || '';
        }
      }
    }
  });
}

/* ========================================================
   Render All
   ======================================================== */
function renderAll() {
  applyTheme(state.settings.theme || 'dark');
  updateClock();
  renderSearchEngines();
  selectSearchEngine(state.settings.activeSearchEngine || 'google', false);
  updateSortButtonUI();
  renderSites();
  renderTodos();
  renderNotes();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
}

/* ========================================================
   Event Listeners Setup
   ======================================================== */
function setupEventListeners() {
  if (typeof document === 'undefined') return;

  // Clock ticker
  updateClock();
  setInterval(updateClock, 1000);

  // Theme toggle
  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

  // Search Engine Dropdown Toggle
  if (activeEngineBtn) {
    activeEngineBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      engineDropdown.classList.toggle('open');
    });
  }

  document.addEventListener('click', (e) => {
    if (engineDropdown && !e.target.closest('.engine-selector-container')) {
      engineDropdown.classList.remove('open');
    }
  });

  // Search input typing: show/hide clear button
  if (searchInput && clearSearchBtn) {
    searchInput.addEventListener('input', () => {
      clearSearchBtn.style.display = searchInput.value.length > 0 ? 'flex' : 'none';
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      searchInput.focus();
    });
  }

  // Search submission
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSearch(searchInput.value);
    });
  }

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Esc closes modals and clears search
    if (e.key === 'Escape') {
      if (siteModal && siteModal.style.display !== 'none') closeSiteModal();
      if (helpModal && helpModal.style.display !== 'none') helpModal.style.display = 'none';
      if (engineDropdown && engineDropdown.classList.contains('open')) engineDropdown.classList.remove('open');
      if (document.activeElement === searchInput) {
        searchInput.value = '';
        if (clearSearchBtn) clearSearchBtn.style.display = 'none';
      }
    }

    // Ctrl + K or / focuses search input
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA')) {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  // Toggle Sites Sorting (Visits vs Manual)
  if (toggleSortBtn) {
    toggleSortBtn.addEventListener('click', () => {
      state.settings.sortByVisits = !state.settings.sortByVisits;
      updateSortButtonUI();
      renderSites();
      apiRequest('/api/settings', 'PUT', { sortByVisits: state.settings.sortByVisits });
    });
  }

  // Add Site Button
  if (addSiteBtn) addSiteBtn.addEventListener('click', () => openSiteEditModal());
  if (closeSiteModalBtn) closeSiteModalBtn.addEventListener('click', closeSiteModal);
  if (cancelSiteModalBtn) cancelSiteModalBtn.addEventListener('click', closeSiteModal);

  // Delete Site button in modal
  if (deleteSiteModalBtn) {
    deleteSiteModalBtn.addEventListener('click', () => {
      const id = siteFormId.value;
      if (id) {
        state.sites = state.sites.filter(s => s.id !== id);
        renderSites();
        closeSiteModal();
        apiRequest(`/api/sites/${id}`, 'DELETE');
      }
    });
  }

  // Save Site Form
  if (siteForm) {
    siteForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = siteFormId.value;
      const title = siteFormTitle.value.trim();
      let url = siteFormUrl.value.trim();
      const pinned = siteFormPinned.checked;

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      if (id) {
        apiRequest(`/api/sites/${id}`, 'PUT', { title, url, pinned }).then(() => {
          closeSiteModal();
        });
      } else {
        apiRequest('/api/sites', 'POST', { title, url, pinned, visits: 1 }).then(() => {
          closeSiteModal();
        });
      }
    });
  }

  // Todo Filters
  if (filterTabs) {
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTodoFilter = tab.dataset.filter;
        renderTodos();
      });
    });
  }

  // Add Todo Form
  if (addTodoForm) {
    addTodoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = todoInput.value.trim();
      if (!text) return;
      todoInput.value = '';
      apiRequest('/api/todos', 'POST', { text });
      todoInput.focus();
    });
  }

  // Add Sticky Note Button
  if (addNoteBtn) {
    addNoteBtn.addEventListener('click', () => {
      const colors = ['yellow', 'mint', 'pink', 'blue', 'lavender'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      apiRequest('/api/notes', 'POST', {
        title: 'New Note',
        content: '',
        color: randomColor
      });
    });
  }

  // Help Modal
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      if (serverAddressCode) serverAddressCode.textContent = window.location.origin || 'http://localhost:48173';
      if (helpModal) helpModal.style.display = 'flex';
    });
  }
  if (closeHelpModalBtn) closeHelpModalBtn.addEventListener('click', () => { if (helpModal) helpModal.style.display = 'none'; });
  if (okHelpModalBtn) okHelpModalBtn.addEventListener('click', () => { if (helpModal) helpModal.style.display = 'none'; });

  // Close modals on clicking outside card
  window.addEventListener('click', (e) => {
    if (e.target === siteModal) closeSiteModal();
    if (e.target === helpModal) helpModal.style.display = 'none';
  });
}

// Initial Boot (browser only)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initDOMElements();
    setupEventListeners();
    renderAll();
    setupRealtimeSync();
  });
}

// Export for node unit tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SEARCH_ENGINES,
    resolveSearchTarget,
    getSortedSites,
    escapeHtml
  };
}
