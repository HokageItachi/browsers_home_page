const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../server');

describe('Backend REST API & Storage Test Suite', () => {
  const testDir = path.join(__dirname, 'temp_api_test');
  const testDataFile = path.join(testDir, 'storage.json');
  let app;
  let port;
  let baseUrl;

  before(async () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Write fresh test dataset
    fs.writeFileSync(testDataFile, JSON.stringify({
      settings: { theme: 'dark', userName: 'Tester', activeSearchEngine: 'google', sortByVisits: true },
      sites: [{ id: 'site-test-1', title: 'Example', url: 'https://example.com', visits: 5, pinned: false }],
      todos: [{ id: 'todo-test-1', text: 'Initial task', completed: false, createdAt: Date.now() }],
      notes: [{ id: 'note-test-1', title: 'Init Note', content: 'Init Content', color: 'yellow', updatedAt: Date.now() }]
    }), 'utf-8');

    app = createApp({ dataFile: testDataFile, port: 0 }); // port 0 assigns random available port
    const res = await app.start();
    port = res.port;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    if (app) await app.stop();
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('Static Assets: Serves index.html with 200 and UTF-8 charset', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('text/html'));
    const body = await res.text();
    assert.ok(body.includes('<!DOCTYPE html>'));
    assert.ok(body.includes('Most Visited Sites'));
  });

  test('Static Assets: Serves CSS with text/css', async () => {
    const res = await fetch(`${baseUrl}/css/style.css`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/css'));
  });

  test('Static Assets: Serves JS with application/javascript', async () => {
    const res = await fetch(`${baseUrl}/js/app.js`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('javascript'));
  });

  test('CORS: OPTIONS returns 204 with Access-Control headers', async () => {
    const res = await fetch(`${baseUrl}/api/state`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.ok(res.headers.get('access-control-allow-methods').includes('GET'));
  });

  test('State: GET /api/state returns full initial state', async () => {
    const res = await fetch(`${baseUrl}/api/state`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.settings.userName, 'Tester');
    assert.equal(data.sites.length, 1);
    assert.equal(data.todos.length, 1);
    assert.equal(data.notes.length, 1);
  });

  test('Settings: PUT /api/settings updates settings', async () => {
    const res = await fetch(`${baseUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'light', activeSearchEngine: 'duckduckgo' })
    });
    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.theme, 'light');
    assert.equal(updated.activeSearchEngine, 'duckduckgo');
  });

  test('Sites: POST /api/sites adds a new site with protocol normalization', async () => {
    const res = await fetch(`${baseUrl}/api/sites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'GitHub', url: 'github.com', pinned: true })
    });
    assert.equal(res.status, 201);
    const site = await res.json();
    assert.equal(site.title, 'GitHub');
    assert.equal(site.url, 'https://github.com');
    assert.equal(site.pinned, true);
    assert.equal(site.visits, 1);
  });

  test('Sites: POST /api/sites/:id/visit increments visit counter', async () => {
    const res = await fetch(`${baseUrl}/api/sites/site-test-1/visit`, { method: 'POST' });
    assert.equal(res.status, 200);
    const site = await res.json();
    assert.equal(site.visits, 6);
  });

  test('Sites: POST /api/sites/nonexistent/visit returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/sites/does-not-exist/visit`, { method: 'POST' });
    assert.equal(res.status, 404);
  });

  test('Sites: PUT /api/sites/:id updates site metadata', async () => {
    const res = await fetch(`${baseUrl}/api/sites/site-test-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Example V2', pinned: true })
    });
    assert.equal(res.status, 200);
    const site = await res.json();
    assert.equal(site.title, 'Example V2');
    assert.equal(site.pinned, true);
  });

  test('Sites: DELETE /api/sites/:id removes the site', async () => {
    const res = await fetch(`${baseUrl}/api/sites/site-test-1`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    const check = await fetch(`${baseUrl}/api/state`).then(r => r.json());
    assert.ok(!check.sites.some(s => s.id === 'site-test-1'));
  });

  test('Todos: POST /api/todos creates new task', async () => {
    const res = await fetch(`${baseUrl}/api/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '  Write comprehensive tests  ' })
    });
    assert.equal(res.status, 201);
    const todo = await res.json();
    assert.equal(todo.text, 'Write comprehensive tests');
    assert.equal(todo.completed, false);
    assert.ok(todo.id.startsWith('todo-'));
  });

  test('Todos: PUT /api/todos/:id toggles completion status', async () => {
    const res = await fetch(`${baseUrl}/api/todos/todo-test-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true })
    });
    assert.equal(res.status, 200);
    const todo = await res.json();
    assert.equal(todo.completed, true);
  });

  test('Todos: DELETE /api/todos/:id removes task', async () => {
    const res = await fetch(`${baseUrl}/api/todos/todo-test-1`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    const check = await fetch(`${baseUrl}/api/state`).then(r => r.json());
    assert.ok(!check.todos.some(t => t.id === 'todo-test-1'));
  });

  test('Notes: POST /api/notes creates sticky note', async () => {
    const res = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Important Reminder', content: 'Buy milk & eggs', color: 'mint' })
    });
    assert.equal(res.status, 201);
    const note = await res.json();
    assert.equal(note.title, 'Important Reminder');
    assert.equal(note.content, 'Buy milk & eggs');
    assert.equal(note.color, 'mint');
    assert.ok(note.id.startsWith('note-'));
  });

  test('Notes: PUT /api/notes/:id updates note content & color', async () => {
    const res = await fetch(`${baseUrl}/api/notes/note-test-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated Note Body', color: 'pink' })
    });
    assert.equal(res.status, 200);
    const note = await res.json();
    assert.equal(note.content, 'Updated Note Body');
    assert.equal(note.color, 'pink');
  });

  test('Notes: DELETE /api/notes/:id removes sticky note', async () => {
    const res = await fetch(`${baseUrl}/api/notes/note-test-1`, { method: 'DELETE' });
    assert.equal(res.status, 200);
    const check = await fetch(`${baseUrl}/api/state`).then(r => r.json());
    assert.ok(!check.notes.some(n => n.id === 'note-test-1'));
  });

  test('Persistence: Changes are written to storage file on disk', async () => {
    app.saveStateSync();
    assert.ok(fs.existsSync(testDataFile));
    const diskContent = JSON.parse(fs.readFileSync(testDataFile, 'utf-8'));
    assert.equal(diskContent.settings.theme, 'light');
    assert.ok(diskContent.todos.some(t => t.text === 'Write comprehensive tests'));
  });
});
