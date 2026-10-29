const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createApp } = require('../server');

// Helper to simulate an SSE client browser connection
function connectMockBrowser(baseUrl, clientId) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}/api/events`);
    const events = [];
    const eventListeners = [];

    const req = http.request(url, {
      headers: {
        'Accept': 'text/event-stream',
        'X-Client-ID': clientId
      }
    }, (res) => {
      let buffer = '';

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep remainder

        for (const part of parts) {
          if (!part.trim()) continue;
          let eventType = 'message';
          let eventData = '';

          const lines = part.split('\n');
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6).trim();
            }
          }

          const parsed = { type: eventType, raw: eventData };
          try {
            parsed.data = JSON.parse(eventData);
          } catch (e) {
            parsed.data = eventData;
          }
          events.push(parsed);

          // Notify any waiting listeners
          for (let i = eventListeners.length - 1; i >= 0; i--) {
            if (eventListeners[i].type === eventType) {
              eventListeners[i].resolve(parsed);
              eventListeners.splice(i, 1);
            }
          }
        }
      });

      resolve({
        clientId,
        req,
        res,
        events,
        waitForEvent: (type, timeoutMs = 2000) => {
          // Check if already received
          const existing = events.find(e => e.type === type);
          if (existing) return Promise.resolve(existing);

          return new Promise((resWait, rejWait) => {
            const timer = setTimeout(() => {
              rejWait(new Error(`Timeout waiting for event: ${type}`));
            }, timeoutMs);

            eventListeners.push({
              type,
              resolve: (val) => {
                clearTimeout(timer);
                resWait(val);
              }
            });
          });
        },
        close: () => {
          req.destroy();
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

describe('Real-Time Multi-Browser Cross-Synchronization Test Suite', () => {
  const testDir = path.join(__dirname, 'temp_sync_test');
  const testDataFile = path.join(testDir, 'storage.json');
  let app;
  let port;
  let baseUrl;

  before(async () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testDataFile, JSON.stringify({
      settings: { theme: 'dark', userName: 'SyncTester', activeSearchEngine: 'google' },
      sites: [],
      todos: [],
      notes: [{ id: 'note-shared-1', title: 'Shared Note', content: 'Initial', color: 'yellow', updatedAt: Date.now() }]
    }), 'utf-8');

    app = createApp({ dataFile: testDataFile, port: 0 });
    const res = await app.start();
    port = res.port;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    if (app) await app.stop();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('Multi-Browser: 3 distinct browsers connect and receive initial state', async () => {
    const browserChrome = await connectMockBrowser(baseUrl, 'client-chrome');
    const browserFirefox = await connectMockBrowser(baseUrl, 'client-firefox');
    const browserEdge = await connectMockBrowser(baseUrl, 'client-edge');

    const initChrome = await browserChrome.waitForEvent('init');
    const initFirefox = await browserFirefox.waitForEvent('init');
    const initEdge = await browserEdge.waitForEvent('init');

    assert.equal(initChrome.data.settings.userName, 'SyncTester');
    assert.equal(initFirefox.data.settings.userName, 'SyncTester');
    assert.equal(initEdge.data.settings.userName, 'SyncTester');

    assert.equal(app.sseClients.size, 3);

    browserChrome.close();
    browserFirefox.close();
    browserEdge.close();
  });

  test('Multi-Browser To-Do Sync: Browser 1 adds a task -> Browser 2 & 3 receive update in real time', async () => {
    const browser1 = await connectMockBrowser(baseUrl, 'browser-1');
    const browser2 = await connectMockBrowser(baseUrl, 'browser-2');
    const browser3 = await connectMockBrowser(baseUrl, 'browser-3');

    await browser1.waitForEvent('init');
    await browser2.waitForEvent('init');
    await browser3.waitForEvent('init');

    // Browser 1 adds a todo
    const postRes = await fetch(`${baseUrl}/api/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': 'browser-1'
      },
      body: JSON.stringify({ text: 'Sync to all 3 browsers' })
    });
    assert.equal(postRes.status, 201);

    // Verify Browser 2 receives event
    const eventBrowser2 = await browser2.waitForEvent('todos_updated');
    assert.ok(eventBrowser2.data.todos.some(t => t.text === 'Sync to all 3 browsers'));
    assert.equal(eventBrowser2.data.originClientId, 'browser-1');

    // Verify Browser 3 receives event
    const eventBrowser3 = await browser3.waitForEvent('todos_updated');
    assert.ok(eventBrowser3.data.todos.some(t => t.text === 'Sync to all 3 browsers'));

    browser1.close();
    browser2.close();
    browser3.close();
  });

  test('Multi-Browser Sticky Notes Sync: Browser 2 edits a note -> Browser 1 receives update instantly', async () => {
    const browser1 = await connectMockBrowser(baseUrl, 'browser-1');
    const browser2 = await connectMockBrowser(baseUrl, 'browser-2');

    await browser1.waitForEvent('init');
    await browser2.waitForEvent('init');

    // Browser 2 updates note
    const updateRes = await fetch(`${baseUrl}/api/notes/note-shared-1`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': 'browser-2'
      },
      body: JSON.stringify({ title: 'Updated Title', content: 'Synced across browsers!', color: 'mint' })
    });
    assert.equal(updateRes.status, 200);

    // Browser 1 receives updated note
    const eventBrowser1 = await browser1.waitForEvent('notes_updated');
    const updatedNote = eventBrowser1.data.notes.find(n => n.id === 'note-shared-1');
    assert.equal(updatedNote.title, 'Updated Title');
    assert.equal(updatedNote.content, 'Synced across browsers!');
    assert.equal(updatedNote.color, 'mint');
    assert.equal(eventBrowser1.data.originClientId, 'browser-2');

    browser1.close();
    browser2.close();
  });

  test('Multi-Browser Sites Sync: Browser 1 adds site -> Browser 2 receives update instantly', async () => {
    const browser1 = await connectMockBrowser(baseUrl, 'browser-1');
    const browser2 = await connectMockBrowser(baseUrl, 'browser-2');

    await browser1.waitForEvent('init');
    await browser2.waitForEvent('init');

    await fetch(`${baseUrl}/api/sites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-ID': 'browser-1'
      },
      body: JSON.stringify({ title: 'DuckDuckGo', url: 'https://duckduckgo.com', pinned: true })
    });

    const eventBrowser2 = await browser2.waitForEvent('sites_updated');
    assert.ok(eventBrowser2.data.sites.some(s => s.title === 'DuckDuckGo'));

    browser1.close();
    browser2.close();
  });
});
