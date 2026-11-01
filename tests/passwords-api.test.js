const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../server');
const { createPasswordScanner } = require('../password-scanner');

describe('Password Manager API & Scanner Test Suite', () => {
  const testDir = path.join(__dirname, 'temp_pwd_test');
  const testDataFile = path.join(testDir, 'storage.json');
  let app;
  let port;
  let baseUrl;

  before(async () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(testDataFile, JSON.stringify({
      settings: { theme: 'dark', userName: 'Tester' },
      sites: [],
      todos: [],
      notes: [],
      bookmarks: [],
      passwords: [
        {
          id: 'pw-test-1',
          title: 'GitHub',
          url: 'https://github.com',
          username: 'octocat',
          password: 'SecretPassword123!',
          category: 'Developer',
          notes: 'Main work account',
          starred: true,
          createdAt: 1700000000000,
          updatedAt: 1700000000000
        }
      ]
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

  test('Static Assets: Serves passwords.html with 200', async () => {
    const res = await fetch(`${baseUrl}/passwords.html`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(body.includes('Password Vault'));
    assert.ok(body.includes('pm-app'));
  });

  test('Static Assets: Serves css/passwords.css', async () => {
    const res = await fetch(`${baseUrl}/css/passwords.css`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/css'));
  });

  test('Static Assets: Serves js/passwords.js', async () => {
    const res = await fetch(`${baseUrl}/js/passwords.js`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('javascript'));
  });

  test('Passwords: GET /api/passwords returns all passwords', async () => {
    const res = await fetch(`${baseUrl}/api/passwords`);
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.equal(Array.isArray(list), true);
    assert.equal(list.length, 1);
    assert.equal(list[0].title, 'GitHub');
    assert.equal(list[0].username, 'octocat');
  });

  test('Passwords: POST /api/passwords creates a new entry', async () => {
    const res = await fetch(`${baseUrl}/api/passwords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Google',
        url: 'https://google.com',
        username: 'user@gmail.com',
        password: 'GooglePassword#2026',
        category: 'Email',
        notes: 'Personal email',
        tags: ['Google', 'Work']
      })
    });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.ok(created.id);
    assert.equal(created.title, 'Google');
    assert.equal(created.category, 'Email');
    assert.equal(created.password, 'GooglePassword#2026');

    // Verify in GET
    const listRes = await fetch(`${baseUrl}/api/passwords`);
    const list = await listRes.json();
    assert.equal(list.length, 2);
  });

  test('Passwords: PUT /api/passwords/:id updates metadata', async () => {
    const res = await fetch(`${baseUrl}/api/passwords/pw-test-1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: 'Updated note here',
        starred: false
      })
    });
    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.notes, 'Updated note here');
    assert.equal(updated.starred, false);
  });

  test('Passwords: PUT /api/passwords/categories/rename renames category', async () => {
    const res = await fetch(`${baseUrl}/api/passwords/categories/rename`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldName: 'Email', newName: 'Communication' })
    });
    assert.equal(res.status, 200);

    const listRes = await fetch(`${baseUrl}/api/passwords`);
    const list = await listRes.json();
    const google = list.find(p => p.title === 'Google');
    assert.equal(google.category, 'Communication');
  });

  test('Passwords: POST /api/passwords/import imports multiple items', async () => {
    const res = await fetch(`${baseUrl}/api/passwords/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { title: 'Slack', url: 'https://slack.com', username: 'work@co.com', password: 'SlackPwd!1', category: 'Work' },
        { title: 'Netflix', url: 'https://netflix.com', username: 'movie@home.com', password: 'NetflixPass#9', category: 'Entertainment' }
      ])
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.importedCount, 2);

    const listRes = await fetch(`${baseUrl}/api/passwords`);
    const list = await listRes.json();
    assert.equal(list.length, 4);
  });

  test('Passwords: POST /api/passwords/sync triggers scanner gracefully', async () => {
    const res = await fetch(`${baseUrl}/api/passwords/sync`, { method: 'POST' });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(typeof data.totalCount, 'number');
  });

  test('Passwords: DELETE /api/passwords/:id removes entry', async () => {
    const res = await fetch(`${baseUrl}/api/passwords/pw-test-1`, { method: 'DELETE' });
    assert.equal(res.status, 200);

    const listRes = await fetch(`${baseUrl}/api/passwords`);
    const list = await listRes.json();
    assert.equal(list.some(p => p.id === 'pw-test-1'), false);
  });

  test('Scanner: createPasswordScanner initializes and stops gracefully', () => {
    const mockState = { passwords: [] };
    const scanner = createPasswordScanner({
      getState: () => mockState,
      saveState: () => {},
      broadcast: () => {},
      intervalMs: 999999
    });
    assert.ok(scanner.start);
    assert.ok(scanner.stop);
    assert.ok(scanner.scan);
    scanner.stop();
  });
});
