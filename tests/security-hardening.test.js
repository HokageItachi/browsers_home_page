const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createApp } = require("../server");
const { resolveSearchTarget, escapeHtml } = require("../public/js/app");

// Unique markers that exist ONLY inside server.js. If any of these appear in a
// static response, the server has leaked its own source code (path traversal).
const SERVER_SOURCE_MARKERS = [
  "vault_auth_token_check_v1",
  "function createApp(",
  "Request entity too large",
  "AES-256-GCM",
];

const TRAVERSAL_PAYLOADS = [
  "/../server.js",
  "/../../server.js",
  "/..%2fserver.js",
  "/%2e%2e%2fserver.js",
  "/..%5cserver.js",
  "/sub/../../server.js",
  "/sub/..%2f..%2fserver.js",
  "/..\\server.js",
  "/..%5c..%5cserver.js",
  "/data/storage.json",
  "/../data/storage.json",
  "/..%2fdata/storage.json",
  "/..%2f..%2fdata/storage.json",
  "/data/storage.local.json",
  "/../etc/passwd",
  "/..%2f..%2fetc/passwd",
  "/%2e%2e/%2e%2e/etc/passwd",
];

describe("Security: Static Path Traversal Protection", () => {
  const testDir = path.join(__dirname, "temp_sec_traversal");
  const testDataFile = path.join(testDir, "storage.json");
  let app, port, baseUrl;

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
        passwords: [],
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
    try {
      if (fs.existsSync(testDir))
        fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  test("Positive control: normal static CSS asset is served with 200", async () => {
    const res = await fetch(`${baseUrl}/css/style.css`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type").includes("text/css"));
  });

  for (const payload of TRAVERSAL_PAYLOADS) {
    test(`Path traversal blocked: ${JSON.stringify(payload)}`, async () => {
      const res = await fetch(`${baseUrl}${payload}`);
      const body = await res.text();
      for (const marker of SERVER_SOURCE_MARKERS) {
        assert.ok(
          !body.includes(marker),
          `Response for ${payload} leaked source marker: ${marker}`,
        );
      }
      const okStatus = res.status === 200 || res.status === 404;
      assert.ok(
        okStatus,
        `Response status ${res.status} should be 200 (fallback) or 404`,
      );
    });
  }

  test("Requesting /server.js under public must not return server source", async () => {
    const res = await fetch(`${baseUrl}/server.js`);
    const body = await res.text();
    assert.ok(!body.includes("function createApp("));
    assert.ok(!body.includes("vault_auth_token_check_v1"));
  });
});

describe("Security: Search Routing & XSS Escaping Edge Cases", () => {
  test("javascript: scheme is NEVER emitted as a navigation target", () => {
    const target = resolveSearchTarget("javascript:alert(1)");
    assert.ok(target);
    assert.ok(!target.startsWith("javascript:"), `got ${target}`);
    assert.ok(target.startsWith("https://"));
  });

  test("file:// / data: / ssh: schemes are treated as search, not raw URLs", () => {
    for (const q of [
      "file:///etc/passwd",
      "data:text/html,<script>",
      "ssh://host",
      "javascript:window.location",
    ]) {
      const target = resolveSearchTarget(q);
      assert.ok(target && target.startsWith("https://"), `q=${q} -> ${target}`);
      assert.ok(
        !target.startsWith("file:") &&
          !target.startsWith("data:") &&
          !target.startsWith("ssh:"),
      );
    }
  });

  test("HTML/JS injection in a query is percent-encoded", () => {
    const target = resolveSearchTarget("<script>alert(1)</script>");
    assert.ok(target);
    assert.ok(
      !target.includes("<script>"),
      `raw <script> leaked into ${target}`,
    );
    assert.ok(target.includes("%3Cscript%3E"));
  });

  test("Quotes, angle brackets and ampersands are encoded in URLs", () => {
    const target = resolveSearchTarget('a"b<c>&d');
    assert.ok(!target.includes('"'));
    assert.ok(!target.includes("<"));
    assert.ok(!target.includes(">"));
    assert.ok(!target.includes("&d"));
  });

  test("escapeHtml returns empty string for falsy / non-string input", () => {
    assert.equal(escapeHtml(null), "");
    assert.equal(escapeHtml(undefined), "");
    assert.equal(escapeHtml(""), "");
    assert.equal(escapeHtml(0), "");
    assert.equal(escapeHtml(123), "123");
  });

  test("escapeHtml neutralizes common XSS payloads (no unescaped markup remains)", () => {
    const payloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      '<a href="javascript:alert(1)">click</a>',
      '<iframe src="http://evil.example"></iframe>',
      '"><svg onload=alert(1)>',
      "`<script>`",
      "<!-- <script> -->",
      '<div onmouseover="alert(1)">',
    ];
    for (const p of payloads) {
      const out = escapeHtml(p);
      // Key invariant: after escaping, no raw markup delimiters remain, so no
      // element/attribute can ever be parsed by the browser.
      assert.ok(!out.includes("<"), `raw < survived escaping: ${out}`);
      assert.ok(!out.includes(">"), `raw > survived escaping: ${out}`);
      assert.ok(!out.includes('"'), `raw " survived escaping: ${out}`);
      assert.ok(out.includes("&lt;"));
    }
  });

  test("escapeHtml encodes all five dangerous characters", () => {
    const out = escapeHtml(`& < > " '`);
    assert.equal(out, "&amp; &lt; &gt; &quot; &#039;");
  });
});

describe("Security: API Input Robustness & Prototype Pollution", () => {
  const testDir = path.join(__dirname, "temp_sec_api");
  const testDataFile = path.join(testDir, "storage.json");
  let app, port, baseUrl;

  const get = async (p) => {
    const res = await fetch(`${baseUrl}${p}`);
    return { status: res.status, body: await res.text() };
  };
  const send = async (method, p, body, headers = {}) => {
    const res = await fetch(`${baseUrl}${p}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.text() };
  };

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
        passwords: [],
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
    try {
      if (fs.existsSync(testDir))
        fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  });

  test("Invalid JSON body is rejected with 400, not 500", async () => {
    const res = await send("PUT", "/api/settings", "this is not json {");
    assert.equal(res.status, 400);
    const j = JSON.parse(res.body);
    assert.ok(j.error);
  });

  test("Oversized request body is rejected with 413", async () => {
    const big = "x".repeat(5.5 * 1024 * 1024); // > 5MB limit
    const res = await send("POST", "/api/todos", `{"text":"${big}"}`);
    assert.equal(res.status, 413);
  });

  test("Server stays responsive after malformed requests", async () => {
    const r = await get("/api/state");
    assert.equal(r.status, 200);
    JSON.parse(r.body);
  });

  test("POST site without url returns 400 (no 500 crash)", async () => {
    const missingUrl = await send("POST", "/api/sites", { title: "No URL" });
    assert.equal(missingUrl.status, 400);
    const badUrl = await send("POST", "/api/sites", { title: "x", url: 12345 });
    assert.equal(badUrl.status, 400);
  });

  test("Unknown API route returns 404", async () => {
    const r = await get("/api/does-not-exist");
    assert.equal(r.status, 404);
  });

  test("Wrong HTTP method on an existing resource returns 404 (not a crash)", async () => {
    const r = await get("/api/sites"); // GET is not defined for /api/sites
    assert.equal(r.status, 404);
  });

  test("Prototype pollution is blocked: __proto__/constructor keys do not pollute Object.prototype", async () => {
    // Send the payload as a RAW JSON string so __proto__ arrives as an own JSON
    // property (JSON.parse creates an own property; the object-literal form in
    // JS would silently set the prototype instead and never transmit the key).
    const rawPayload =
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"pollutedCtor":true}},"prototype":{"pollutedViaProto":true}}';
    const res = await send("PUT", "/api/settings", rawPayload);
    assert.equal(res.status, 200);

    assert.equal({}.polluted, undefined);
    assert.equal({}.pollutedCtor, undefined);
    assert.equal({}.pollutedViaProto, undefined);
    assert.equal(Object.prototype.polluted, undefined);

    const fresh = {};
    assert.equal(fresh.polluted, undefined);
    assert.equal(fresh.pollutedCtor, undefined);

    const r = await get("/api/state");
    assert.equal(r.status, 200);
  });

  test("Mass assignment cannot overwrite resource ids", async () => {
    const created = await send("POST", "/api/todos", { text: "keep me" });
    assert.equal(created.status, 201);
    const todo = JSON.parse(created.body);
    const origId = todo.id;

    const upd = await send("PUT", `/api/todos/${origId}`, {
      text: "changed",
      id: "evil-id",
      createdAt: "hacked",
    });
    assert.equal(upd.status, 200);
    const updatedTodo = JSON.parse(upd.body);
    assert.equal(updatedTodo.id, origId, "id must stay the owned id");
    assert.equal(updatedTodo.text, "changed");
  });

  test("GET /api/state never returns raw __proto__ keys we injected", async () => {
    const r = await get("/api/state");
    const st = JSON.parse(r.body);
    assert.equal(st.settings.polluted, undefined);
    assert.equal(st.settings.pollutedCtor, undefined);
  });
});
