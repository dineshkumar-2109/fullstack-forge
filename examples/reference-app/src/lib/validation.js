// @ts-check
/**
 * Minimal schema validation (a stand-in for Zod/Pydantic so the app has zero runtime deps).
 * Key properties a real validator must also have:
 *  - unknown fields are REJECTED (blocks mass assignment such as {"ownerId": "..."} or {"role": "admin"})
 *  - every failure reports field + reason, all at once
 *  - output is a new, normalized object; the raw input is never passed further
 */
import { validationError } from "./errors.js";

/**
 * @template T
 * @typedef {{ parse: (value: unknown, field: string) => { ok: true, value: T } | { ok: false, reason: string }, optional?: boolean }} Field
 */

/**
 * @param {{ min?: number, max?: number, trim?: boolean, pattern?: RegExp, patternReason?: string, lowercase?: boolean }} [opts]
 * @returns {Field<string>}
 */
export function string({ min = 0, max = 10_000, trim = true, pattern, patternReason = "invalid_format", lowercase = false } = {}) {
  return {
    parse(value) {
      if (typeof value !== "string") return { ok: false, reason: "must_be_string" };
      let s = trim ? value.trim() : value;
      if (lowercase) s = s.toLowerCase();
      if (s.length < min) return { ok: false, reason: min === 1 ? "required" : `min_length_${min}` };
      if (s.length > max) return { ok: false, reason: `max_length_${max}` };
      if (pattern && !pattern.test(s)) return { ok: false, reason: patternReason };
      // Reject control characters (except tab/newline) — they break logs, exports and UIs.
      // eslint-disable-next-line no-control-regex -- matching control characters is the point
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s)) return { ok: false, reason: "invalid_characters" };
      return { ok: true, value: s };
    },
  };
}

/** Email: pragmatic check; real verification happens by sending a verification email. */
export const email = () => string({ min: 3, max: 254, lowercase: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternReason: "invalid_email" });

/** Calendar date YYYY-MM-DD that actually exists. @returns {Field<string>} */
export function isoDate() {
  return {
    parse(value) {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { ok: false, reason: "invalid_date" };
      const d = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return { ok: false, reason: "invalid_date" };
      return { ok: true, value };
    },
  };
}

/** @param {{ min?: number, max?: number }} [opts] @returns {Field<number>} */
export function integer({ min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  return {
    parse(value) {
      if (typeof value !== "number" || !Number.isInteger(value)) return { ok: false, reason: "must_be_integer" };
      if (value < min) return { ok: false, reason: `min_${min}` };
      if (value > max) return { ok: false, reason: `max_${max}` };
      return { ok: true, value };
    },
  };
}

/** @template {string} T @param {readonly T[]} values @returns {Field<T>} */
export function oneOf(values) {
  return {
    parse(value) {
      return values.includes(/** @type {T} */ (value)) ? { ok: true, value: /** @type {T} */ (value) } : { ok: false, reason: `must_be_one_of:${values.join("|")}` };
    },
  };
}

/** @template T @param {Field<T>} field @returns {Field<T|null>} */
export function nullable(field) {
  return { ...field, parse: (value, name) => (value === null ? { ok: true, value: null } : field.parse(value, name)) };
}

/** @template T @param {Field<T>} field @returns {Field<T>} */
export function optional(field) {
  return { ...field, optional: true };
}

/**
 * @template {Record<string, Field<any>>} S
 * @param {S} shape
 * @param {{ requireAtLeastOne?: boolean }} [opts]
 * @returns {(input: unknown) => { [K in keyof S]: S[K] extends Field<infer T> ? T : never }}
 */
export function object(shape, { requireAtLeastOne = false } = {}) {
  return (input) => {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw validationError([{ field: "body", reason: "must_be_object" }]);
    }
    /** @type {{ field: string, reason: string }[]} */
    const details = [];
    /** @type {Record<string, unknown>} */
    const out = {};
    const record = /** @type {Record<string, unknown>} */ (input);
    for (const key of Object.keys(record)) {
      if (!Object.hasOwn(shape, key)) details.push({ field: key, reason: "unknown_field" });
    }
    for (const [key, field] of Object.entries(shape)) {
      if (!Object.hasOwn(record, key) || record[key] === undefined) {
        if (!field.optional) details.push({ field: key, reason: "required" });
        continue;
      }
      const result = field.parse(record[key], key);
      if (result.ok) out[key] = result.value;
      else details.push({ field: key, reason: result.reason });
    }
    if (requireAtLeastOne && details.length === 0 && Object.keys(out).length === 0) {
      details.push({ field: "body", reason: "no_fields_to_update" });
    }
    if (details.length > 0) throw validationError(details);
    return /** @type {any} */ (out);
  };
}
