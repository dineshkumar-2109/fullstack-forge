// @ts-check
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "migrations");

/**
 * Open the SQLite database with production-safe pragmas.
 * SQLite is a solid choice for a single-instance app; for multiple instances, switch the
 * repositories to PostgreSQL (the SQL is portable; see docs/runbook.md).
 * @param {string} path
 */
export function openDatabase(path) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  return db;
}

/**
 * Apply pending *.sql migrations in filename order, each in its own transaction.
 * Applied migrations are recorded and never re-run. Migrations are forward-only:
 * fix mistakes with a new migration, never by editing an applied one.
 * @param {DatabaseSync} db @param {string} [dir]
 * @returns {string[]} names of migrations applied now
 */
export function migrate(db, dir = MIGRATIONS_DIR) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set(db.prepare("SELECT name FROM schema_migrations").all().map((r) => String(r.name)));
  const pending = readdirSync(dir).filter((f) => f.endsWith(".sql") && !applied.has(f)).sort();
  for (const name of pending) {
    transaction(db, () => {
      db.exec(readFileSync(join(dir, name), "utf8"));
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
    });
  }
  return pending;
}

/**
 * Run fn inside a transaction; roll back on any error.
 * @template T @param {DatabaseSync} db @param {() => T} fn @returns {T}
 */
export function transaction(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/** @param {unknown} err */
export const isUniqueViolation = (err) => err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
