const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { createApp } = require('../server');

// Minimal Chrome DevTools Protocol client
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.msgId = 0;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const res = JSON.parse(event.data);
          if (res.id && this.pending.has(res.id)) {
            const { resolve: resPromise, reject: rejPromise } = this.pending.get(res.id);
            this.pending.delete(res.id);
            if (res.error) rejPromise(new Error(res.error.message));
            else resPromise(res.result);
          }
        } catch (e) {}
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${res.exceptionDetails.text}`);
    }
    return res.result ? res.result.value : undefined;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

describe('End-to-End Headless Chrome UI & UX Tests', () => {
  const testDir = path.join(__dirname, 'temp_e2e_test');
  const testDataFile = path.join(testDir, 'storage.json');
  const chromeDataDir = path.join(os.tmpdir(), `e2e-chrome-profile-${Date.now()}`);
  const chromePort = 9225;

  let app;
  let serverPort;
  let baseUrl;
  let chromeProc;
  let cdpTab1;
  let cdpTab2;

  before(async () => {
    // 1. Prepare clean test storage
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testDataFile, JSON.stringify({
      settings: { theme: 'dark', userName: 'E2E_User', activeSearchEngine: 'google', sortByVisits: true },
      sites: [{ id: 'site-e2e', title: 'TestSite', url: 'https://example.com', visits: 10, pinned: true }],
      todos: [{ id: 'todo-e2e', text: 'Existing E2E Task', completed: false, createdAt: Date.now() }],
      notes: [{ id: 'note-e2e', title: 'Existing Note', content: 'Note content', color: 'yellow', updatedAt: Date.now() }]
    }), 'utf-8');

    // 2. Start Test Server
    app = createApp({ dataFile: testDataFile, port: 0 });
    const srv = await app.start();
    serverPort = srv.port;
    baseUrl = `http://127.0.0.1:${serverPort}`;

    // 3. Launch Headless Chrome
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    chromeProc = spawn(chromePath, [
      '--headless=new',
      `--remote-debugging-port=${chromePort}`,
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${chromeDataDir}`,
      'about:blank'
    ]);

    // Wait for Chrome DevTools port to become ready
    let connected = false;
    for (let i = 0; i < 30; i++) {
      try {
        const v = await fetch(`http://127.0.0.1:${chromePort}/json/version`);
        if (v.ok) { connected = true; break; }
      } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }
    if (!connected) throw new Error('Headless Chrome failed to initialize debugging port');

    // Tab 1 setup
    const newTabRes = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const tab1Info = await newTabRes.json();
    cdpTab1 = new CDPClient(tab1Info.webSocketDebuggerUrl);
    await cdpTab1.connect();
    await cdpTab1.send('Page.enable');
    await cdpTab1.send('Runtime.enable');

    // Wait for DOM & SSE to connect
    for (let i = 0; i < 20; i++) {
      const syncText = await cdpTab1.evaluate(`document.getElementById('syncLabel')?.textContent || ''`);
      if (syncText.includes('Synced')) break;
      await new Promise(r => setTimeout(r, 150));
    }
  });

  after(async () => {
    if (cdpTab1) cdpTab1.close();
    if (cdpTab2) cdpTab2.close();
    if (chromeProc) chromeProc.kill();
    if (app) await app.stop();

    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
      if (fs.existsSync(chromeDataDir)) fs.rmSync(chromeDataDir, { recursive: true, force: true });
    } catch (e) {}
  });

  test('UI Render: Live Clock, Sync Badge, and Header Greeting', async () => {
    const greeting = await cdpTab1.evaluate(`document.getElementById('greetingText').textContent`);
    assert.ok(greeting.includes('E2E_User'));

    const syncLabelText = await cdpTab1.evaluate(`document.getElementById('syncLabel').textContent`);
    assert.ok(syncLabelText.includes('Synced'));

    const sitesCount = await cdpTab1.evaluate(`document.getElementById('sitesCountBadge').textContent`);
    assert.equal(sitesCount, '1');
  });

  test('Search UI & Clear Button UX', async () => {
    // Type into search input
    await cdpTab1.evaluate(`
      const input = document.getElementById('searchInput');
      input.value = 'hello test';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    `);

    // Verify clear button is visible
    const clearBtnDisplay = await cdpTab1.evaluate(`document.getElementById('clearSearchBtn').style.display`);
    assert.equal(clearBtnDisplay, 'flex');

    // Click clear button
    await cdpTab1.evaluate(`document.getElementById('clearSearchBtn').click()`);

    // Verify input is cleared
    const valAfter = await cdpTab1.evaluate(`document.getElementById('searchInput').value`);
    assert.equal(valAfter, '');
  });

  test('Theme Toggle UX: Toggles html data-theme between dark and light', async () => {
    const initialTheme = await cdpTab1.evaluate(`document.documentElement.getAttribute('data-theme')`);
    assert.equal(initialTheme, 'dark');

    // Click theme toggle button
    await cdpTab1.evaluate(`document.getElementById('themeToggleBtn').click()`);
    await new Promise(r => setTimeout(r, 200));

    const toggledTheme = await cdpTab1.evaluate(`document.documentElement.getAttribute('data-theme')`);
    assert.equal(toggledTheme, 'light');

    // Toggle back to dark
    await cdpTab1.evaluate(`document.getElementById('themeToggleBtn').click()`);
    await new Promise(r => setTimeout(r, 200));
    assert.equal(await cdpTab1.evaluate(`document.documentElement.getAttribute('data-theme')`), 'dark');
  });

  test('To-Do List UI: Adding task and toggling checkbox', async () => {
    // Add new task
    await cdpTab1.evaluate(`
      (() => {
        const input = document.getElementById('todoInput');
        input.value = 'Headless browser automated task';
        document.getElementById('addTodoForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      })()
    `);

    // Wait for item to appear in DOM
    let taskFound = false;
    for (let i = 0; i < 20; i++) {
      taskFound = await cdpTab1.evaluate(`
        Array.from(document.querySelectorAll('.todo-text'))
             .some(el => el.textContent.includes('Headless browser automated task'))
      `);
      if (taskFound) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(taskFound, 'New todo should be rendered in UI');

    // Check completion checkbox
    await cdpTab1.evaluate(`
      (() => {
        const item = Array.from(document.querySelectorAll('.todo-item'))
                          .find(el => el.querySelector('.todo-text').textContent.includes('Headless browser automated task'));
        if (item) {
          const cb = item.querySelector('.todo-checkbox');
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    const isCompletedClass = await cdpTab1.evaluate(`
      (() => {
        const item = Array.from(document.querySelectorAll('.todo-item'))
                          .find(el => el.querySelector('.todo-text').textContent.includes('Headless browser automated task'));
        return item ? item.classList.contains('completed') : false;
      })()
    `);
    assert.equal(isCompletedClass, true);
  });

  test('Sticky Notes UI: Creating a new note card and typing', async () => {
    const countBefore = await cdpTab1.evaluate(`document.querySelectorAll('.sticky-note').length`);

    // Click "+ New Note"
    await cdpTab1.evaluate(`document.getElementById('addNoteBtn').click()`);

    let countAfter = countBefore;
    for (let i = 0; i < 20; i++) {
      countAfter = await cdpTab1.evaluate(`document.querySelectorAll('.sticky-note').length`);
      if (countAfter > countBefore) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert.equal(countAfter, countBefore + 1);
  });

  test('Viewport Layout: No page scroll — entire UI fits within viewport', async () => {
    // Set viewport to a standard 1366x768 laptop display
    await cdpTab1.send('Emulation.setDeviceMetricsOverride', {
      width: 1366, height: 768, deviceScaleFactor: 1, mobile: false
    });
    await new Promise(r => setTimeout(r, 300));

    const overflows = await cdpTab1.evaluate(`
      (() => {
        const docH = document.documentElement.scrollHeight;
        const winH = window.innerHeight;
        return { docH, winH, overflows: docH > winH };
      })()
    `);

    assert.equal(overflows.overflows, false,
      `Page should not scroll: scrollHeight (${overflows.docH}) must be <= innerHeight (${overflows.winH})`);

    // Clean up — remove device override
    await cdpTab1.send('Emulation.clearDeviceMetricsOverride');
    await new Promise(r => setTimeout(r, 100));
  });

  test('Viewport Layout: Dashboard panels have internal scroll, not page scroll', async () => {
    await cdpTab1.send('Emulation.setDeviceMetricsOverride', {
      width: 1366, height: 768, deviceScaleFactor: 1, mobile: false
    });
    await new Promise(r => setTimeout(r, 300));

    const layout = await cdpTab1.evaluate(`
      (() => {
        const appContainer = document.querySelector('.app-container');
        const todoListContainer = document.querySelector('.todo-list-container');
        const notesBoard = document.querySelector('.sticky-notes-board');
        const style = (el) => window.getComputedStyle(el);

        return {
          appOverflow: style(appContainer).overflow,
          todoOverflowY: style(todoListContainer).overflowY,
          notesOverflowY: style(notesBoard).overflowY,
          bodyOverflow: style(document.body).overflow,
        };
      })()
    `);

    assert.equal(layout.bodyOverflow, 'hidden', 'body overflow should be hidden');
    assert.equal(layout.appOverflow, 'hidden', '.app-container overflow should be hidden');
    assert.equal(layout.todoOverflowY, 'auto', '.todo-list-container should scroll internally');
    assert.equal(layout.notesOverflowY, 'auto', '.sticky-notes-board should scroll internally');

    await cdpTab1.send('Emulation.clearDeviceMetricsOverride');
    await new Promise(r => setTimeout(r, 100));
  });

  test('Viewport Layout: Sites section uses horizontal scroll strip', async () => {
    const sitesLayout = await cdpTab1.evaluate(`
      (() => {
        const grid = document.querySelector('.sites-grid');
        const style = window.getComputedStyle(grid);
        return {
          display: style.display,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          flexWrap: style.flexWrap,
        };
      })()
    `);

    assert.equal(sitesLayout.display, 'flex', '.sites-grid should use flexbox');
    assert.equal(sitesLayout.overflowX, 'auto', '.sites-grid should scroll horizontally');
    assert.equal(sitesLayout.overflowY, 'hidden', '.sites-grid should not scroll vertically');
  });

  test('Multi-Tab Real-Time Sync: Changes in Tab 2 instantly reflect in Tab 1 without refresh', async () => {
    // Open Tab 2
    const tab2Res = await fetch(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(baseUrl)}`, { method: 'PUT' });
    const tab2Info = await tab2Res.json();
    cdpTab2 = new CDPClient(tab2Info.webSocketDebuggerUrl);
    await cdpTab2.connect();
    await cdpTab2.send('Page.enable');
    await cdpTab2.send('Runtime.enable');

    // Wait for Tab 2 sync
    for (let i = 0; i < 20; i++) {
      const syncText = await cdpTab2.evaluate(`document.getElementById('syncLabel')?.textContent || ''`);
      if (syncText.includes('Synced')) break;
      await new Promise(r => setTimeout(r, 150));
    }

    // In Tab 2: Add a task "Created in Browser 2"
    await cdpTab2.evaluate(`
      const input = document.getElementById('todoInput');
      input.value = 'Created in Browser 2';
      document.getElementById('addTodoForm').dispatchEvent(new Event('submit', { bubbles: true }));
    `);

    // Verify Tab 1 receives and renders it without any manual page reload!
    let syncedInTab1 = false;
    for (let i = 0; i < 25; i++) {
      syncedInTab1 = await cdpTab1.evaluate(`
        Array.from(document.querySelectorAll('.todo-text'))
             .some(el => el.textContent.includes('Created in Browser 2'))
      `);
      if (syncedInTab1) break;
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(syncedInTab1, 'Tab 1 must receive real-time SSE update from Tab 2 immediately');
  });
});
