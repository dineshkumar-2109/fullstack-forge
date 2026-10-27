// @ts-check
/**
 * Configuration: every environment variable is read and validated HERE, once, at startup.
 * The rest of the app receives a typed, frozen object and never touches process.env.
 */

/**
 * @typedef {object} Config
 * @property {'development'|'test'|'production'} env
 * @property {string} host
 * @property {number} port
 * @property {string} databasePath
 * @property {number} sessionTtlHours
 * @property {'debug'|'info'|'warn'|'error'|'silent'} logLevel
 * @property {boolean} trustProxy
 * @property {number} maxBodyBytes
 * @property {number} rateLimitAuthPerMinute
 * @property {number} rateLimitApiPerMinute
 * @property {string|null} publicOrigin
 */

/**
 * @param {Record<string, string|undefined>} [env]
 * @returns {Readonly<Config>}
 */
export function loadConfig(env = process.env) {
  /** @type {string[]} */
  const errors = [];

  /** @param {string} name @param {string[]} allowed @param {string} fallback */
  const oneOf = (name, allowed, fallback) => {
    const value = env[name] ?? fallback;
    if (!allowed.includes(value)) errors.push(`${name} must be one of ${allowed.join(", ")} (got "${value}")`);
    return value;
  };
  /** @param {string} name @param {number} fallback @param {number} min @param {number} max */
  const int = (name, fallback, min, max) => {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      errors.push(`${name} must be an integer between ${min} and ${max} (got "${raw}")`);
      return fallback;
    }
    return value;
  };
  /** @param {string} name @param {boolean} fallback */
  const bool = (name, fallback) => {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    if (!["true", "false", "1", "0"].includes(raw)) errors.push(`${name} must be true or false (got "${raw}")`);
    return raw === "true" || raw === "1";
  };

  const nodeEnv = /** @type {Config['env']} */ (oneOf("NODE_ENV", ["development", "test", "production"], "development"));
  const databasePath = env.DATABASE_PATH ?? (nodeEnv === "test" ? ":memory:" : "./data/tasklane.db");
  const publicOrigin = env.PUBLIC_ORIGIN || null;
  if (publicOrigin !== null && !/^https?:\/\/[^/\s]+$/.test(publicOrigin)) {
    errors.push(`PUBLIC_ORIGIN must be an origin like https://app.example.com with no path (got "${publicOrigin}")`);
  }
  if (nodeEnv === "production" && databasePath === ":memory:") {
    errors.push("DATABASE_PATH must be a file path in production (in-memory data would be lost)");
  }

  /** @type {Config} */
  const config = {
    env: nodeEnv,
    host: env.HOST || "0.0.0.0",
    port: int("PORT", 3000, 0, 65535),
    databasePath,
    sessionTtlHours: int("SESSION_TTL_HOURS", 24 * 14, 1, 24 * 90),
    logLevel: /** @type {Config['logLevel']} */ (oneOf("LOG_LEVEL", ["debug", "info", "warn", "error", "silent"], nodeEnv === "test" ? "silent" : "info")),
    trustProxy: bool("TRUST_PROXY", false),
    maxBodyBytes: int("MAX_BODY_BYTES", 64 * 1024, 1024, 10 * 1024 * 1024),
    rateLimitAuthPerMinute: int("RATE_LIMIT_AUTH_PER_MINUTE", 10, 1, 10_000),
    rateLimitApiPerMinute: int("RATE_LIMIT_API_PER_MINUTE", 300, 1, 100_000),
    publicOrigin,
  };

  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${errors.join("\n  - ")}\nSee .env.example for every supported variable.`);
  }
  return Object.freeze(config);
}
