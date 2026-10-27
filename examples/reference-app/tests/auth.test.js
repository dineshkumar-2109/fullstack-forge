import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startTestApp } from "./helpers.js";

describe("authentication", () => {
  let t;
  before(async () => { t = await startTestApp(); });
  after(async () => { await t.close(); });

  test("sign up creates the user, sets a hardened session cookie, and never returns the password hash", async () => {
    const c = t.client();
    const res = await c.post("/api/auth/signup", { email: "  Alice@Example.com ", password: "correct horse battery" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, "alice@example.com", "email is normalized");
    assert.match(res.body.user.id, /^usr_/);
    assert.equal(JSON.stringify(res.body).includes("hash"), false);
    assert.match(res.setCookie, /^sid=[A-Za-z0-9_-]{40,};/);
    assert.match(res.setCookie, /HttpOnly/);
    assert.match(res.setCookie, /SameSite=Lax/);
    const me = await c.get("/api/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, "alice@example.com");
  });

  test("session token is stored only as a hash", async () => {
    const c = t.client();
    await c.signUp();
    const token = decodeURIComponent(c.cookie.split("=")[1]);
    const rows = t.db.prepare("SELECT token_hash FROM sessions").all();
    assert.ok(rows.length > 0);
    assert.ok(rows.every((r) => r.token_hash !== token && /^[a-f0-9]{64}$/.test(r.token_hash)));
  });

  test("passwords are hashed with scrypt and a per-user salt", async () => {
    const c = t.client();
    await c.signUp("salt1@example.com", "same password here");
    await t.client().signUp("salt2@example.com", "same password here");
    const [a, b] = t.db.prepare("SELECT password_hash FROM users WHERE email IN ('salt1@example.com','salt2@example.com')").all();
    assert.match(a.password_hash, /^scrypt\$/);
    assert.notEqual(a.password_hash, b.password_hash);
  });

  test("duplicate email (case-insensitive) is a 409 with a field detail", async () => {
    await t.client().signUp("dupe@example.com");
    const res = await t.client().post("/api/auth/signup", { email: "DUPE@example.com", password: "another password 1" });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, "CONFLICT");
    assert.deepEqual(res.body.error.details, [{ field: "email", reason: "already_registered" }]);
  });

  test("weak or malformed credentials are rejected with field-level details", async () => {
    const res = await t.client().post("/api/auth/signup", { email: "not-an-email", password: "short" });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    const fields = Object.fromEntries(res.body.error.details.map((d) => [d.field, d.reason]));
    assert.equal(fields.email, "invalid_email");
    assert.equal(fields.password, "min_length_10");
    assert.ok(res.body.error.requestId);
  });

  test("sign in: wrong password and unknown email give the identical response", async () => {
    await t.client().signUp("bob@example.com", "bobs secure password");
    const wrong = await t.client().post("/api/auth/signin", { email: "bob@example.com", password: "nope nope nope" });
    const unknown = await t.client().post("/api/auth/signin", { email: "nobody@example.com", password: "nope nope nope" });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.code, unknown.body.error.code);
    assert.equal(wrong.body.error.message, unknown.body.error.message);
    const ok = await t.client().post("/api/auth/signin", { email: "BOB@example.com", password: "bobs secure password" });
    assert.equal(ok.status, 200);
  });

  test("sign out invalidates the session server-side", async () => {
    const c = t.client();
    await c.signUp();
    const cookie = c.cookie;
    assert.equal((await c.post("/api/auth/signout")).status, 204);
    c.cookie = cookie; // replaying the old cookie must not work
    assert.equal((await c.get("/api/me")).status, 401);
  });

  test("sessions expire", async () => {
    const c = t.client();
    await c.signUp();
    t.tick(15 * 24 * 3600_000); // default TTL is 14 days
    const res = await c.get("/api/me");
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, "UNAUTHENTICATED");
  });

  test("session probe returns 200 with null when signed out, and the user when signed in", async () => {
    const c = t.client();
    assert.deepEqual((await c.get("/api/session")).body, { user: null });
    await c.signUp("probe@example.com");
    assert.equal((await c.get("/api/session")).body.user.email, "probe@example.com");
  });

  test("protected endpoints require a session", async () => {
    for (const [method, path] of [["GET", "/api/me"], ["GET", "/api/projects"], ["POST", "/api/projects"], ["GET", "/api/me/export"]]) {
      const res = await t.client().request(method, path, method === "POST" ? { json: { name: "x" } } : {});
      assert.equal(res.status, 401, `${method} ${path}`);
    }
  });

  test("account export contains the user's data and no secrets", async () => {
    const c = t.client();
    await c.signUp("export@example.com");
    const { body: { project } } = await c.post("/api/projects", { name: "Exported" });
    await c.post(`/api/projects/${project.id}/tasks`, { title: "Exported task" });
    const res = await c.get("/api/me/export");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition"), /attachment/);
    assert.equal(res.body.user.email, "export@example.com");
    assert.equal(res.body.projects.length, 1);
    assert.equal(res.body.tasks[0].title, "Exported task");
    assert.equal(JSON.stringify(res.body).includes("scrypt"), false);
  });

  test("account deletion requires the password and erases all user data", async () => {
    const c = t.client();
    const user = await c.signUp("leaver@example.com", "leaving password 1");
    const { body: { project } } = await c.post("/api/projects", { name: "Doomed" });
    await c.post(`/api/projects/${project.id}/tasks`, { title: "Doomed task" });

    const wrong = await c.delete("/api/me", { password: "wrong password" });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.error.details[0].reason, "incorrect_password");

    const ok = await c.delete("/api/me", { password: "leaving password 1" });
    assert.equal(ok.status, 204);
    for (const table of ["users", "sessions", "projects", "tasks"]) {
      const col = table === "users" ? "id" : table === "sessions" ? "user_id" : "owner_id";
      assert.equal(t.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`).get(user.id).n, 0, table);
    }
    assert.equal((await c.get("/api/me")).status, 401);
  });
});
