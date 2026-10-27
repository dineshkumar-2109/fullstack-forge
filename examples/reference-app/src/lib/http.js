// @ts-check
import { badRequest, payloadTooLarge, unsupportedMediaType } from "./errors.js";

/**
 * @typedef {import('node:http').IncomingMessage} Req
 * @typedef {import('node:http').ServerResponse} Res
 * @typedef {{ id: string, email: string, createdAt: string }} User
 * @typedef {{ req: Req, res: Res, params: Record<string, string>, query: URLSearchParams, requestId: string, user: User|null, sessionToken: string|undefined, ip: string, body: () => Promise<unknown> }} Ctx
 * @typedef {(ctx: Ctx) => Promise<{ status: number, body?: unknown, headers?: Record<string, string> }>} Handler
 */

/**
 * Read a JSON body with a hard size limit (protects memory) and strict content type.
 * @param {Req} req @param {number} maxBytes @returns {Promise<unknown>}
 */
export async function readJson(req, maxBytes) {
  const type = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw unsupportedMediaType();
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > maxBytes) throw payloadTooLarge();
  /** @type {Buffer[]} */
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw payloadTooLarge();
    chunks.push(chunk);
  }
  if (size === 0) throw badRequest("A JSON body is required.");
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw badRequest("The request body is not valid JSON.");
  }
}

/** @param {string|undefined} header @returns {Record<string, string>} */
export function parseCookies(header) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (name) {
      try { out[name] = decodeURIComponent(value); } catch { /* ignore malformed cookie */ }
    }
  }
  return out;
}

/**
 * @param {string} name @param {string} value
 * @param {{ maxAgeSeconds: number, secure: boolean }} opts
 */
export function serializeCookie(name, value, { maxAgeSeconds, secure }) {
  return [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSeconds}`, ...(secure ? ["Secure"] : [])].join("; ");
}

/** Tiny router: exact segments and :params, with 404 vs 405 distinction. */
export class Router {
  constructor() {
    /** @type {{ method: string, parts: string[], handler: Handler, auth: boolean }[]} */
    this.routes = [];
  }

  /** @param {string} method @param {string} pattern @param {Handler} handler @param {{ auth?: boolean }} [opts] */
  add(method, pattern, handler, { auth = true } = {}) {
    this.routes.push({ method, parts: pattern.split("/").filter(Boolean), handler, auth });
    return this;
  }

  /**
   * @param {string} method @param {string} pathname
   * @returns {{ handler: Handler, params: Record<string, string>, auth: boolean } | { notAllowed: string[] } | null}
   */
  match(method, pathname) {
    const segments = pathname.split("/").filter(Boolean);
    /** @type {string[]} */
    const allowed = [];
    for (const route of this.routes) {
      if (route.parts.length !== segments.length) continue;
      /** @type {Record<string, string>} */
      const params = {};
      let ok = true;
      for (let i = 0; i < route.parts.length; i++) {
        const part = route.parts[i];
        if (part.startsWith(":")) {
          try { params[part.slice(1)] = decodeURIComponent(segments[i]); } catch { ok = false; break; }
        } else if (part !== segments[i]) { ok = false; break; }
      }
      if (!ok) continue;
      if (route.method === method) return { handler: route.handler, params, auth: route.auth };
      allowed.push(route.method);
    }
    return allowed.length ? { notAllowed: allowed } : null;
  }
}

/**
 * Opaque cursor for keyset pagination over (created_at DESC, id DESC).
 * @param {{ createdAt: string, id: string }} row
 */
export const encodeCursor = (row) => Buffer.from(JSON.stringify([row.createdAt, row.id])).toString("base64url");

/** @param {string|null} cursor @returns {{ createdAt: string, id: string } | null} */
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === "string" && typeof value[1] === "string") {
      return { createdAt: value[0], id: value[1] };
    }
  } catch { /* fall through */ }
  throw badRequest("Invalid pagination cursor.");
}

/** @param {URLSearchParams} query @param {number} [fallback] @param {number} [max] */
export function parseLimit(query, fallback = 20, max = 100) {
  const raw = query.get("limit");
  if (raw === null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > max) throw badRequest(`limit must be an integer between 1 and ${max}.`);
  return n;
}
