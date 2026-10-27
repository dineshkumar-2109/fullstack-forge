// @ts-check
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { AppError, forbidden, notFound, toErrorResponse, tooManyRequests, unauthenticated } from "./lib/errors.js";
import { Router, parseCookies, readJson } from "./lib/http.js";
import { RateLimiter, securityHeaders } from "./lib/security.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { SESSION_COOKIE, registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { createProjectService } from "./modules/projects/projects.service.js";
import { registerProjectRoutes } from "./modules/projects/projects.routes.js";
import { createTaskService } from "./modules/tasks/tasks.service.js";
import { registerTaskRoutes } from "./modules/tasks/tasks.routes.js";

const PUBLIC_DIR = fileURLToPath(new URL("../public", import.meta.url));
const SPA_ROUTES = new Set(["/", "/login", "/signup", "/app", "/settings", "/terms", "/privacy"]);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json" };
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Static files are read once at startup from an allowlist — no path from the URL ever touches the filesystem. */
function loadStatic() {
  /** @type {Map<string, { body: Buffer, type: string }>} */
  const files = new Map();
  for (const name of readdirSync(PUBLIC_DIR)) {
    const type = MIME[/** @type {keyof typeof MIME} */ (extname(name))];
    if (type) files.set(`/${name}`, { body: readFileSync(join(PUBLIC_DIR, name)), type });
  }
  return files;
}

/**
 * Build the request handler. Everything external (config, db, logger, clock) is injected,
 * which is what makes the app fully testable.
 * @param {{ config: Readonly<import('./config.js').Config>, db: import('node:sqlite').DatabaseSync, logger: import('./lib/logger.js').Logger, now?: () => Date }} deps
 */
export function createApp({ config, db, logger, now = () => new Date() }) {
  const isProd = config.env === "production";
  const headers = { ...securityHeaders(isProd) };
  const staticFiles = loadStatic();
  const indexHtml = staticFiles.get("/index.html");

  const auth = createAuthService({ db, now, sessionTtlHours: config.sessionTtlHours });
  const projects = createProjectService({ db, now });
  const tasks = createTaskService({ db, now });

  const router = new Router();
  registerAuthRoutes(router, { auth, secureCookies: isProd });
  registerProjectRoutes(router, { projects });
  registerTaskRoutes(router, { tasks });

  const authLimiter = new RateLimiter({ limit: config.rateLimitAuthPerMinute, windowMs: 60_000, now: () => now().getTime() });
  const apiLimiter = new RateLimiter({ limit: config.rateLimitApiPerMinute, windowMs: 60_000, now: () => now().getTime() });
  let shuttingDown = false;

  /** @param {import('node:http').IncomingMessage} req */
  const clientIp = (req) => {
    const fwd = req.headers["x-forwarded-for"];
    if (config.trustProxy && typeof fwd === "string") return fwd.split(",")[0].trim();
    return req.socket.remoteAddress || "unknown";
  };

  /** CSRF defence for cookie auth: SameSite=Lax cookies + reject cross-origin state changes. @param {import('node:http').IncomingMessage} req */
  const assertSameOrigin = (req) => {
    if (req.headers["sec-fetch-site"] === "cross-site") throw forbidden("Cross-site requests are not allowed.");
    const origin = req.headers.origin;
    if (!origin) return; // non-browser clients (curl, server-to-server) don't send Origin
    const expected = config.publicOrigin ?? `${isProd ? "https" : "http"}://${req.headers.host}`;
    if (origin !== expected) throw forbidden("Cross-origin requests are not allowed.");
  };

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  async function handle(req, res) {
    const started = process.hrtime.bigint();
    const incomingId = req.headers["x-request-id"];
    const requestId = typeof incomingId === "string" && REQUEST_ID.test(incomingId) ? incomingId : randomUUID();
    const url = new URL(req.url || "/", "http://internal");
    const method = req.method || "GET";
    /** @type {string|null} */
    let userId = null;
    let status = 500;

    /** @param {number} code @param {unknown} body @param {Record<string, string>} [extra] */
    const sendJson = (code, body, extra = {}) => {
      status = code;
      const payload = body === undefined ? "" : JSON.stringify(body);
      res.writeHead(code, {
        ...headers, ...extra, "X-Request-Id": requestId, "Cache-Control": "no-store",
        ...(payload ? { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) } : {}),
      });
      res.end(payload);
    };

    try {
      // ---- health -------------------------------------------------------------
      if (url.pathname === "/healthz") return sendJson(200, { status: "ok" });
      if (url.pathname === "/readyz") {
        if (shuttingDown) return sendJson(503, { status: "shutting_down" });
        db.prepare("SELECT 1").get();
        return sendJson(200, { status: "ready" });
      }

      // ---- API ----------------------------------------------------------------
      if (url.pathname.startsWith("/api/")) {
        const ip = clientIp(req);
        if (UNSAFE_METHODS.has(method)) assertSameOrigin(req);
        if (method === "POST" && (url.pathname === "/api/auth/signin" || url.pathname === "/api/auth/signup")) {
          const r = authLimiter.hit(`auth:${ip}`);
          if (!r.allowed) throw tooManyRequests(r.retryAfterSeconds);
        }
        const sessionToken = parseCookies(req.headers.cookie)[SESSION_COOKIE];
        const user = auth.authenticate(sessionToken);
        userId = user?.id ?? null;
        const limit = apiLimiter.hit(user ? `user:${user.id}` : `ip:${ip}`);
        if (!limit.allowed) throw tooManyRequests(limit.retryAfterSeconds);

        const match = router.match(method, url.pathname);
        if (!match) throw notFound("Endpoint");
        if ("notAllowed" in match) {
          throw new AppError(405, "METHOD_NOT_ALLOWED", "This method is not supported for this endpoint.", { headers: { Allow: match.notAllowed.join(", ") } });
        }
        if (match.auth && !user) throw unauthenticated();
        const result = await match.handler({
          req, res, params: match.params, query: url.searchParams, requestId, user, sessionToken, ip,
          body: () => readJson(req, config.maxBodyBytes),
        });
        return sendJson(result.status, result.body, result.headers);
      }

      // ---- static + SPA ---------------------------------------------------------
      if (method !== "GET" && method !== "HEAD") throw new AppError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", { headers: { Allow: "GET, HEAD" } });
      const file = SPA_ROUTES.has(url.pathname) ? indexHtml : staticFiles.get(url.pathname);
      const isMiss = !file || url.pathname === "/index.html";
      const served = isMiss ? indexHtml : file; // the SPA renders its own friendly 404 view
      status = isMiss ? 404 : 200;
      if (!served) throw notFound("Page");
      res.writeHead(status, {
        ...headers, "X-Request-Id": requestId, "Content-Type": served.type, "Content-Length": served.body.length,
        "Cache-Control": served.type.startsWith("text/html") ? "no-cache" : "public, max-age=300",
      });
      res.end(method === "HEAD" ? undefined : served.body);
    } catch (err) {
      const out = toErrorResponse(err, requestId);
      if (out.unexpected) logger.error("unhandled_error", { requestId, method, path: url.pathname, err });
      if (!res.headersSent) sendJson(out.status, out.body, out.headers);
      else res.destroy();
    } finally {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      // Path only — query strings can carry tokens or PII.
      logger.info("http_request", { requestId, method, path: url.pathname, status, durationMs: Math.round(durationMs * 10) / 10, userId });
    }
  }

  return {
    handle,
    auth,
    beginShutdown() { shuttingDown = true; },
  };
}
