// @ts-check
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = /** @type {(pw: string, salt: Buffer, keylen: number, opts: object) => Promise<Buffer>} */ (promisify(scryptCb));

// scrypt parameters (OWASP: N=2^17,r=8,p=1 is ideal; 2^15 keeps login latency acceptable on small instances).
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

/** @param {string} password @returns {Promise<string>} */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), hash.toString("base64url")].join("$");
}

/** @param {string} password @param {string} stored @returns {Promise<boolean>} */
export async function verifyPassword(password, stored) {
  const [alg, n, r, p, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64url"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A precomputed hash used to keep sign-in timing similar for unknown emails. */
export const DUMMY_PASSWORD_HASH = await hashPassword("timing-equalizer-not-a-real-password");

/** 256-bit random token for sessions / resets. */
export const newToken = () => randomBytes(32).toString("base64url");

/** @param {string} token */
export const sha256 = (token) => createHash("sha256").update(token).digest("hex");

/** Opaque, unguessable, URL-safe ID with a type prefix (e.g. prj_…). @param {string} prefix */
export const newId = (prefix) => `${prefix}_${randomBytes(12).toString("base64url")}`;

/** @param {boolean} isProduction @returns {Record<string, string>} */
export function securityHeaders(isProduction) {
  return {
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Frame-Options": "DENY",
    ...(isProduction ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

/**
 * Fixed-window rate limiter. In-memory => correct for ONE instance only.
 * For horizontal scaling, replace the Map with a shared store (Redis/DB) behind the same interface.
 */
export class RateLimiter {
  /** @param {{ limit: number, windowMs: number, now?: () => number }} opts */
  constructor({ limit, windowMs, now = Date.now }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    /** @type {Map<string, { count: number, resetAt: number }>} */
    this.buckets = new Map();
  }

  /** @param {string} key @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }} */
  hit(key) {
    const now = this.now();
    if (this.buckets.size > 50_000) this.prune(now);
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }
    bucket.count += 1;
    const allowed = bucket.count <= this.limit;
    return { allowed, remaining: Math.max(0, this.limit - bucket.count), retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  /** @param {number} now */
  prune(now) {
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
  }
}
