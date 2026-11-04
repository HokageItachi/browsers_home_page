const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createApp } = require("../server");

describe("Security: Vault Cryptographic Integrity", () => {
  const testDir = path.join(__dirname, "temp_sec_vault");
  const testDataFile = path.join(testDir, "storage.json");
  const PLAINTEXT_PW = "SuperSecretPlaintextPassword!42";
  const MASTER = "MasterPassword#One";
  const MASTER_NEW = "MasterPassword#Two";
  let app, port, baseUrl;

  const send = async (method, p, body) => {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (method !== "GET" && method !== "HEAD") opts.body = JSON.stringify(body);
    const res = await fetch(`${baseUrl}${p}`, opts);
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };
  const rawDisk = () => JSON.parse(fs.readFileSync(testDataFile, "utf-8"));

  before(async () => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      testDataFile,
      JSON.stringify({
        settings: { theme: "dark", userName: "Sec" },
        sites: [],
        todos: [],
        notes: [],
        bookmarks: [],
        passwords: [
          {
            id: "pw-sec-1",
            title: "ACME",
            url: "https://acme.example",
            username: "alice",
            password: PLAINTEXT_PW,
            category: "Work",
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          },
        ],
        vault: { isConfigured: false, salt: null, testHash: null },
      }),
    );
    app = createApp({ dataFile: testDataFile, port: 0 });
    const r = await app.start();
    port = r.port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (app) await app.stop();
    await new Promise((r) => setTimeout(r, 150));
    try {
      if (fs.existsSync(testDir))
        fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  test("Setup rejects weak master passwords with 400", async () => {
    for (const short of ["", "   ", "abc", "abcde"]) {
      const r = await send("POST", "/api/passwords/vault/setup", {
        masterPassword: short,
      });
      assert.equal(r.status, 400, `master="${short}" should be rejected`);
    }
  });

  test("Unlock before vault is configured returns 400", async () => {
    const r = await send("POST", "/api/passwords/vault/unlock", {
      masterPassword: "whatever",
    });
    assert.equal(r.status, 400);
  });

  test("Configure vault: plaintext is encrypted at rest (AES-256-GCM)", async () => {
    const setup = await send("POST", "/api/passwords/vault/setup", {
      masterPassword: MASTER,
    });
    assert.equal(setup.status, 200);
    assert.equal(setup.body.isConfigured, true);

    await new Promise((r) => setTimeout(r, 150));
    const disk = rawDisk();
    assert.equal(disk.vault.isConfigured, true);
    assert.ok(disk.vault.salt, "salt present");
    assert.ok(disk.vault.testHash, "verifier present");
    assert.ok(disk.vault.salt.length >= 32, "16-byte hex salt");

    for (const p of disk.passwords) {
      assert.ok(
        p.password.startsWith("enc:aes256:"),
        "password must be encrypted on disk",
      );
      assert.ok(
        !p.password.includes(PLAINTEXT_PW),
        "plaintext must never appear on disk",
      );
    }
    const raw = fs.readFileSync(testDataFile, "utf-8");
    assert.ok(
      !raw.includes(PLAINTEXT_PW),
      "plaintext password leaked to storage file",
    );
  });

  test("Locked vault refuses reads/writes and hides plaintext", async () => {
    const lock = await send("POST", "/api/passwords/vault/lock", {});
    assert.equal(lock.status, 200);
    assert.equal(lock.body.isUnlocked, false);

    const list = await send("GET", "/api/passwords", {});
    assert.equal(list.status, 200);
    for (const p of list.body) {
      assert.equal(p.password, "");
      assert.equal(p.isLocked, true);
    }

    const add = await send("POST", "/api/passwords", {
      title: "x",
      url: "https://x.example",
      username: "u",
      password: "p",
    });
    assert.equal(add.status, 403);
    const upd = await send("PUT", "/api/passwords/pw-sec-1", {
      notes: "forbidden",
    });
    assert.equal(upd.status, 403);
  });

  test("Unlock rejects wrong passwords, accepts correct one", async () => {
    const wrong = await send("POST", "/api/passwords/vault/unlock", {
      masterPassword: "WrongPassword!",
    });
    assert.equal(wrong.status, 401);

    const right = await send("POST", "/api/passwords/vault/unlock", {
      masterPassword: MASTER,
    });
    assert.equal(right.status, 200);
    assert.equal(right.body.isUnlocked, true);

    const list = await send("GET", "/api/passwords", {});
    const pw = list.body.find((p) => p.id === "pw-sec-1");
    assert.equal(
      pw.password,
      PLAINTEXT_PW,
      "unlocked vault returns decrypted plaintext",
    );
  });

  test("Change master password: validates current/new and re-encrypts", async () => {
    const noCurrent = await send(
      "POST",
      "/api/passwords/vault/change-password",
      { newMasterPassword: MASTER_NEW },
    );
    assert.equal(noCurrent.status, 400);

    const wrongCurrent = await send(
      "POST",
      "/api/passwords/vault/change-password",
      {
        currentMasterPassword: "WrongPassword!",
        newMasterPassword: MASTER_NEW,
      },
    );
    assert.equal(wrongCurrent.status, 401);

    const shortNew = await send(
      "POST",
      "/api/passwords/vault/change-password",
      {
        currentMasterPassword: MASTER,
        newMasterPassword: "short",
      },
    );
    assert.equal(shortNew.status, 400);

    const ok = await send("POST", "/api/passwords/vault/change-password", {
      currentMasterPassword: MASTER,
      newMasterPassword: MASTER_NEW,
    });
    assert.equal(ok.status, 200);
  });

  test("After change: old password fails, new one works, data decrypts", async () => {
    await send("POST", "/api/passwords/vault/lock", {});

    const oldUnlock = await send("POST", "/api/passwords/vault/unlock", {
      masterPassword: MASTER,
    });
    assert.equal(
      oldUnlock.status,
      401,
      "old master password must no longer work",
    );

    const newUnlock = await send("POST", "/api/passwords/vault/unlock", {
      masterPassword: MASTER_NEW,
    });
    assert.equal(newUnlock.status, 200);

    const list = await send("GET", "/api/passwords", {});
    const pw = list.body.find((p) => p.id === "pw-sec-1");
    assert.equal(
      pw.password,
      PLAINTEXT_PW,
      "data must survive master-password rotation",
    );

    await new Promise((r) => setTimeout(r, 150));
    const raw = fs.readFileSync(testDataFile, "utf-8");
    assert.ok(
      !raw.includes(PLAINTEXT_PW),
      "plaintext must not reappear after rotation",
    );
    const disk = rawDisk();
    for (const p of disk.passwords) {
      assert.ok(p.password.startsWith("enc:aes256:"));
    }
  });

  test("Malformed encrypted records fail closed (return empty, not crash)", async () => {
    // Corrupt a stored password by submitting a malformed ciphertext through
    // the API (vault is unlocked at this point). Decryption must fail closed
    // and return "" rather than crashing or leaking partial data.
    const corrupt = await send("PUT", "/api/passwords/pw-sec-1", {
      password: "enc:aes256:notvalidhex",
    });
    assert.equal(corrupt.status, 200);

    const list = await send("GET", "/api/passwords", {});
    assert.equal(list.status, 200);
    const pw = list.body.find((p) => p.id === "pw-sec-1");
    assert.equal(pw.password, "", "corrupted ciphertext must fail closed");

    // Server stays usable after encountering corrupted data
    const again = await send("GET", "/api/passwords", {});
    assert.equal(again.status, 200);
  });
});
