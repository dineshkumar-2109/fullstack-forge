// @ts-check
/**
 * Structured JSON logger with level filtering and automatic redaction of secret-looking keys.
 * One JSON object per line -> works with every log aggregator.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SECRET_KEY = /pass(word)?|token|secret|authorization|cookie|session|api.?key/i;

/** @param {unknown} value @param {number} depth @returns {unknown} */
function redact(value, depth = 0) {
  if (depth > 5 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEY.test(k) ? "[REDACTED]" : redact(v, depth + 1);
  return out;
}

/**
 * @typedef {(event: string, fields?: Record<string, unknown>) => void} LogFn
 * @typedef {{ debug: LogFn, info: LogFn, warn: LogFn, error: LogFn, child: (bindings: Record<string, unknown>) => Logger }} Logger
 */

/**
 * @param {{ level?: keyof typeof LEVELS, write?: (line: string) => void, bindings?: Record<string, unknown> }} [options]
 * @returns {Logger}
 */
export function createLogger({ level = "info", write = (line) => process.stdout.write(line + "\n"), bindings = {} } = {}) {
  const threshold = LEVELS[level];
  /** @param {keyof typeof LEVELS} lvl @returns {LogFn} */
  const make = (lvl) => (event, fields = {}) => {
    if (LEVELS[lvl] < threshold) return;
    write(JSON.stringify({ time: new Date().toISOString(), level: lvl, event, ...bindings, .../** @type {object} */ (redact(fields)) }));
  };
  return {
    debug: make("debug"), info: make("info"), warn: make("warn"), error: make("error"),
    child: (extra) => createLogger({ level, write, bindings: { ...bindings, ...extra } }),
  };
}
