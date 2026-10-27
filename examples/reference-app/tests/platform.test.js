import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/lib/logger.js";
import { RateLimiter, hashPassword, verifyPassword } from "../src/lib/security.js";
import { isoDate, object, optional, string } from "../src/lib/validation.js";
import { migrate, openDatabase } from "../src/lib/db.js";
import { startTestApp } from "./helpers.js";

describe("config", () => {
  test("defaults are valid", () => {
    const c = loadConfig({});
    assert.equal(c.env, "development");
    assert.equal(c.port, 3000);
    assert.ok(Object.isFrozen(c));
  });
  test("invalid values fail fast with every problem listed", () => {
    assert.throws(() => loadConfig({ PORT: "abc", NODE_ENV: "staging", PUBLIC_ORIGIN: "https://x.com/path" }), (err) => {
      assert.match(err.message, /PORT/);
      assert.match(err.message, /NODE_ENV/);
      assert.match(err.message, /PUBLIC_ORIGIN/);
      return true;
    });
  });
  test("production refuses an in-memory database", () => {
    assert.throws(() => loadConfig({ NODE_ENV: "production", DATABASE_PATH: ":memory:" }), /DATABASE_PATH/);
  });
});

describe("validation", () => {
  const schema = object({ name: string({ min: 1, max: 5 }), due: optional(isoDate()) });
  test("normalizes and returns only declared fields", () => {
    assert.deepEqual(schema({ name: "  abc " }), { name: "abc" });
  });
  test("collects all errors at once", () => {
    assert.throws(() => schema({ name: "toolong", due: "2030-13-01", extra: 1 }), (err) => {
      assert.equal(err.details.length, 3);
      return true;
    });
  });
  test("rejects leap-day impostors", () => {
    assert.equal(isoDate().parse("2029-02-29").ok, false);
    assert.equal(isoDate().parse("2028-02-29").ok, true);
  });
});

describe("passwords", () => {
  test("verify succeeds only for the right password; NFKC-normalized", async () => {
    const hash = await hashPassword("ﬁne password");
    assert.equal(await verifyPassword("fine password", hash), true);
    assert.equal(await verifyPassword("wrong password", hash), false);
    assert.equal(await verifyPassword("anything", "garbage"), false);
  });
});

describe("rate limiter", () => {
  test("fixed window with injectable clock", () => {
    let now = 0;
    const rl = new RateLimiter({ limit: 2, windowMs: 1000, now: () => now });
    assert.equal(rl.hit("k").allowed, true);
    assert.equal(rl.hit("k").allowed, true);
    const third = rl.hit("k");
    assert.equal(third.allowed, false);
    assert.equal(third.retryAfterSeconds, 1);
    assert.equal(rl.hit("other").allowed, true, "keys are independent");
    now = 1001;
    assert.equal(rl.hit("k").allowed, true);
  });
});

describe("logger", () => {
  test("emits JSON lines and redacts secrets at any depth", () => {
    const lines = [];
    const log = createLogger({ level: "info", write: (l) => lines.push(l) }).child({ service: "test" });
    log.debug("hidden");
    log.info("login", { email: "a@b.c", password: "hunter2", nested: { apiKey: "k", ok: 1 }, headers: { authorization: "Bearer x" } });
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.service, "test");
    assert.equal(entry.password, "[REDACTED]");
    assert.equal(entry.nested.apiKey, "[REDACTED]");
    assert.equal(entry.nested.ok, 1);
    assert.equal(entry.headers.authorization, "[REDACTED]");
  });
});

describe("migrations", () => {
  test("are idempotent", () => {
    const db = openDatabase(":memory:");
    assert.ok(migrate(db).length >= 1);
    assert.deepEqual(migrate(db), []);
    db.close();
  });
});

describe("operations endpoints and pages", () => {
  let t;
  const logs = [];
  before(async () => { t = await startTestApp({ logs }); });
  after(async () => { await t.close(); });

  test("health and readiness", async () => {
    const c = t.client();
    assert.deepEqual((await c.get("/healthz")).body, { status: "ok" });
    assert.deepEqual((await c.get("/readyz")).body, { status: "ready" });
    t.app.beginShutdown();
    assert.equal((await c.get("/readyz")).status, 503, "readiness fails during shutdown so traffic drains");
  });

  test("SPA routes serve HTML; unknown pages are a real 404", async () => {
    const c = t.client();
    for (const path of ["/", "/login", "/signup", "/app", "/settings", "/terms", "/privacy"]) {
      const res = await c.get(path);
      assert.equal(res.status, 200, path);
      assert.match(res.headers.get("content-type"), /text\/html/);
    }
    const missing = await c.get("/definitely-not-a-page");
    assert.equal(missing.status, 404);
    const css = await c.get("/styles.css");
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type"), /text\/css/);
  });

  test("access logs are structured, include request ids, and contain no query strings or secrets", async () => {
    const c = t.client();
    await c.post("/api/auth/signup", { email: "log@example.com", password: "log password 123" });
    await c.get("/api/projects?token=should-not-be-logged");
    const entries = logs.map((l) => JSON.parse(l)).filter((e) => e.event === "http_request");
    assert.ok(entries.length >= 2);
    assert.ok(entries.every((e) => e.requestId && typeof e.durationMs === "number"));
    const all = logs.join("\n");
    assert.doesNotMatch(all, /should-not-be-logged|log password 123/);
  });
});
