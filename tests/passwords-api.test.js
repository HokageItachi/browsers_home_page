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

  test('Vault: Setup master password, encrypts storage on disk, locks and unlocks', async () => {
    // 1. Check initial status
    const statusRes1 = await fetch(`${baseUrl}/api/passwords/vault/status`);
    assert.equal(statusRes1.status, 200);
    const s1 = await statusRes1.json();
    assert.equal(s1.isConfigured, false);

    // 2. Setup master password
    const setupRes = await fetch(`${baseUrl}/api/passwords/vault/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterPassword: 'MySecureMasterPassword123!' })
    });
    assert.equal(setupRes.status, 200);
    const setupData = await setupRes.json();
    assert.equal(setupData.isConfigured, true);
    assert.equal(setupData.isUnlocked, true);

    // 3. Verify disk file has encrypted passwords (enc:aes256:...)
    await new Promise(r => setTimeout(r, 150));
    const rawDisk = JSON.parse(fs.readFileSync(testDataFile, 'utf-8'));
    assert.equal(rawDisk.vault.isConfigured, true);
    assert.ok(rawDisk.vault.salt);
    assert.ok(rawDisk.vault.testHash);
    for (const p of rawDisk.passwords) {
      if (p.password) {
        assert.ok(p.password.startsWith('enc:aes256:'), `Expected ${p.password} to start with enc:aes256:`);
      }
    }

    // 4. Lock vault
    const lockRes = await fetch(`${baseUrl}/api/passwords/vault/lock`, { method: 'POST' });
    assert.equal(lockRes.status, 200);

    // 5. When locked, GET /api/passwords does NOT expose plaintext passwords
    const lockedGet = await (await fetch(`${baseUrl}/api/passwords`)).json();
    for (const p of lockedGet) {
      assert.equal(p.password, '', 'Locked vault must return empty passwords');
      assert.equal(p.isLocked, true);
    }

    // 6. Unlock with incorrect password fails with 401
    const wrongRes = await fetch(`${baseUrl}/api/passwords/vault/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterPassword: 'WrongPassword!' })
    });
    assert.equal(wrongRes.status, 401);

    // 7. Unlock with correct password succeeds
    const unlockRes = await fetch(`${baseUrl}/api/passwords/vault/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterPassword: 'MySecureMasterPassword123!' })
    });
    assert.equal(unlockRes.status, 200);

    // 8. When unlocked, GET returns decrypted passwords
    const unlockedGet = await (await fetch(`${baseUrl}/api/passwords`)).json();
    const google = unlockedGet.find(p => p.title === 'Google');
    assert.ok(google);
    assert.equal(google.password, 'GooglePassword#2026');
  });
});
