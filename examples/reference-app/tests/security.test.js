import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startTestApp } from "./helpers.js";

describe("security: authorization (IDOR/BOLA matrix)", () => {
  let t, alice, mallory, project, task;
  before(async () => {
    t = await startTestApp();
    alice = t.client();
    mallory = t.client();
    await alice.signUp("alice@example.com");
    await mallory.signUp("mallory@example.com");
    project = (await alice.post("/api/projects", { name: "Secret plans" })).body.project;
    task = (await alice.post(`/api/projects/${project.id}/tasks`, { title: "Secret task" })).body.task;
  });
  after(async () => { await t.close(); });

  const attempts = () => [
    ["GET", `/api/projects/${project.id}`],
    ["PATCH", `/api/projects/${project.id}`, { name: "pwned" }],
    ["DELETE", `/api/projects/${project.id}`],
    ["GET", `/api/projects/${project.id}/tasks`],
    ["POST", `/api/projects/${project.id}/tasks`, { title: "injected" }],
    ["PATCH", `/api/tasks/${task.id}`, { version: 1, title: "pwned" }],
    ["DELETE", `/api/tasks/${task.id}`],
  ];

  test("another user gets 404 (not 403) for every route and nothing changes", async () => {
    for (const [method, path, json] of attempts()) {
      const res = await mallory.request(method, path, json ? { json } : {});
      assert.equal(res.status, 404, `${method} ${path}`);
      assert.equal(JSON.stringify(res.body).includes("Secret"), false, "no data leaks in the error");
    }
    const still = await alice.get(`/api/projects/${project.id}/tasks`);
    assert.deepEqual(still.body.items.map((x) => x.title), ["Secret task"]);
    assert.equal((await alice.get(`/api/projects/${project.id}`)).body.project.name, "Secret plans");
  });

  test("list endpoints never include other users' data", async () => {
    const res = await mallory.get("/api/projects");
    assert.equal(res.body.items.some((p) => p.id === project.id), false);
  });

  test("mass assignment: unknown fields like ownerId/id/role are rejected", async () => {
    const res = await mallory.post("/api/projects", { name: "Mine", ownerId: "usr_alice", id: "prj_fixed", role: "admin" });
    assert.equal(res.status, 400);
    const unknown = res.body.error.details.filter((d) => d.reason === "unknown_field").map((d) => d.field).sort();
    assert.deepEqual(unknown, ["id", "ownerId", "role"]);
  });
});

describe("security: input handling and transport", () => {
  let t, c;
  before(async () => {
    t = await startTestApp({ env: { MAX_BODY_BYTES: "2048" } });
    c = t.client();
    await c.signUp();
  });
  after(async () => { await t.close(); });

  test("XSS payloads are stored and returned as inert text (rendering uses textContent)", async () => {
    const payload = `<img src=x onerror=alert(1)>`;
    const res = await c.post("/api/projects", { name: payload });
    assert.equal(res.status, 201);
    assert.equal(res.body.project.name, payload);
    assert.match(res.headers.get("content-type"), /application\/json/);
  });

  test("SQL injection strings are treated as data", async () => {
    const res = await c.post("/api/projects", { name: "x'); DROP TABLE projects; --" });
    assert.equal(res.status, 201);
    assert.equal((await c.get("/api/projects")).status, 200);
  });

  test("oversized bodies → 413, malformed JSON → 400, wrong content type → 415", async () => {
    assert.equal((await c.post("/api/projects", { name: "x".repeat(5000) })).status, 413);
    assert.equal((await c.request("POST", "/api/projects", { raw: "{not json" })).status, 400);
    const res = await c.request("POST", "/api/projects", { raw: "name=x", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    assert.equal(res.status, 415);
  });

  test("type confusion and control characters are rejected", async () => {
    for (const body of [{ name: 42 }, { name: ["a"] }, { name: null }, { name: "bad\u0000name" }, ["array"]]) {
      assert.equal((await c.post("/api/projects", body)).status, 400, JSON.stringify(body));
    }
  });

  test("cross-origin state changes are blocked (CSRF defence)", async () => {
    const evil = await c.post("/api/projects", { name: "csrf" }, { headers: { Origin: "https://evil.example" } });
    assert.equal(evil.status, 403);
    const crossSite = await c.post("/api/projects", { name: "csrf2" }, { headers: { "Sec-Fetch-Site": "cross-site" } });
    assert.equal(crossSite.status, 403);
    const same = await c.post("/api/projects", { name: "same-origin" }, { headers: { Origin: t.baseUrl } });
    assert.equal(same.status, 201);
  });

  test("security headers are present on API, pages and errors", async () => {
    for (const path of ["/api/me", "/", "/does-not-exist", "/api/nope"]) {
      const res = await c.get(path);
      assert.match(res.headers.get("content-security-policy") || "", /default-src 'self'/, path);
      assert.equal(res.headers.get("x-content-type-options"), "nosniff", path);
      assert.equal(res.headers.get("x-frame-options"), "DENY", path);
      assert.ok(res.headers.get("x-request-id"), path);
      assert.equal(res.headers.get("x-powered-by"), null, path);
    }
  });

  test("errors never leak internals and always carry a request id", async () => {
    const res = await c.get("/api/projects/prj_doesnotexist");
    assert.equal(res.status, 404);
    assert.deepEqual(Object.keys(res.body.error).sort(), ["code", "message", "requestId"]);
    assert.doesNotMatch(JSON.stringify(res.body), /sqlite|SELECT|at \w+ \(|node:/i);
  });

  test("unknown API routes → 404 JSON; wrong method → 405 with Allow", async () => {
    const missing = await c.get("/api/nope");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "NOT_FOUND");
    const wrong = await c.request("PUT", "/api/projects", { json: {} });
    assert.equal(wrong.status, 405);
    assert.match(wrong.headers.get("allow"), /GET/);
  });

  test("static serving cannot be used for path traversal", async () => {
    for (const path of ["/../package.json", "/%2e%2e/package.json", "/..%2fsrc%2fconfig.js", "/src/config.js"]) {
      const res = await c.get(path);
      assert.equal(res.status, 404, path);
      assert.doesNotMatch(String(res.body), /loadConfig|"devDependencies"/, path);
    }
  });

  test("a valid incoming X-Request-Id is propagated; a malicious one is replaced", async () => {
    const good = await c.get("/healthz", { headers: { "X-Request-Id": "req_abcdef123456" } });
    assert.equal(good.headers.get("x-request-id"), "req_abcdef123456");
    const bad = await c.get("/healthz", { headers: { "X-Request-Id": "evil\" injected" } });
    assert.notEqual(bad.headers.get("x-request-id"), "evil\" injected");
  });
});

describe("security: rate limiting", () => {
  let t;
  before(async () => { t = await startTestApp({ env: { RATE_LIMIT_AUTH_PER_MINUTE: "3" } }); });
  after(async () => { await t.close(); });

  test("sign-in brute force gets 429 with Retry-After, and resets after the window", async () => {
    const c = t.client();
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await c.post("/api/auth/signin", { email: "x@example.com", password: "guess" + i })).status);
    assert.deepEqual(statuses, [401, 401, 401, 429, 429]);
    const limited = await c.post("/api/auth/signin", { email: "x@example.com", password: "again" });
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);
    t.tick(61_000);
    assert.equal((await c.post("/api/auth/signin", { email: "x@example.com", password: "later" })).status, 401);
  });
});
