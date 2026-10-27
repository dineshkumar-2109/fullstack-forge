import { createServer } from "node:http";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/lib/logger.js";
import { migrate, openDatabase } from "../src/lib/db.js";
import { createApp } from "../src/app.js";

/**
 * Start a real HTTP server on a random port with a fresh in-memory database.
 * Each test file gets full isolation; the clock is controllable.
 * @param {{ env?: Record<string, string>, logs?: string[] }} [opts]
 */
export async function startTestApp({ env = {}, logs } = {}) {
  const config = loadConfig({ NODE_ENV: "test", DATABASE_PATH: ":memory:", RATE_LIMIT_AUTH_PER_MINUTE: "1000", ...env });
  const db = openDatabase(config.databasePath);
  migrate(db);
  const clock = { now: new Date("2030-01-10T12:00:00.000Z") };
  const logger = createLogger({ level: logs ? "debug" : "silent", write: (line) => logs?.push(line) });
  const app = createApp({ config, db, logger, now: () => new Date(clock.now) });
  const server = createServer((req, res) => void app.handle(req, res));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(undefined)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  return {
    baseUrl, db, clock, app,
    /** advance the injected clock */
    tick(ms) { clock.now = new Date(clock.now.getTime() + ms); },
    client: () => new Client(baseUrl),
    async close() {
      await new Promise((resolve) => server.close(() => resolve(undefined)));
      db.close();
    },
  };
}

/** Minimal HTTP client with a cookie jar, mimicking a browser session. */
export class Client {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookie = "";
  }

  async request(method, path, { json, headers = {}, raw } = {}) {
    const res = await fetch(this.baseUrl + path, {
      method,
      headers: {
        ...(json !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: raw !== undefined ? raw : json !== undefined ? JSON.stringify(json) : undefined,
      redirect: "manual",
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const [pair] = setCookie.split(";");
      this.cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let body;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, headers: res.headers, body, setCookie };
  }

  get(path, opts) { return this.request("GET", path, opts); }
  post(path, json, opts = {}) { return this.request("POST", path, { ...opts, json }); }
  patch(path, json, opts = {}) { return this.request("PATCH", path, { ...opts, json }); }
  delete(path, json, opts = {}) { return this.request("DELETE", path, { ...opts, json }); }

  /** Sign up a fresh user and keep the session cookie. */
  async signUp(email = `user-${Math.random().toString(36).slice(2, 10)}@example.com`, password = "correct horse battery") {
    const res = await this.post("/api/auth/signup", { email, password });
    if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { ...res.body.user, password };
  }
}
