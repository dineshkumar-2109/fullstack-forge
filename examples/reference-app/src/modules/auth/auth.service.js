// @ts-check
import { conflict, unauthenticated, validationError } from "../../lib/errors.js";
import { isUniqueViolation, transaction } from "../../lib/db.js";
import { DUMMY_PASSWORD_HASH, hashPassword, newId, newToken, sha256, verifyPassword } from "../../lib/security.js";

/**
 * @typedef {import('node:sqlite').DatabaseSync} DatabaseSync
 * @typedef {import('../../lib/http.js').User} User
 */

/** @param {any} row @returns {User} */
const toUser = (row) => ({ id: String(row.id), email: String(row.email), createdAt: String(row.created_at) });

/**
 * @param {{ db: DatabaseSync, now: () => Date, sessionTtlHours: number }} deps
 */
export function createAuthService({ db, now, sessionTtlHours }) {
  const q = {
    insertUser: db.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)"),
    userByEmail: db.prepare("SELECT id, email, password_hash, created_at FROM users WHERE email = ?"),
    userById: db.prepare("SELECT id, email, password_hash, created_at FROM users WHERE id = ?"),
    insertSession: db.prepare("INSERT INTO sessions (id, token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)"),
    sessionUser: db.prepare(
      "SELECT u.id, u.email, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
    ),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token_hash = ?"),
    deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at <= ?"),
    deleteUser: db.prepare("DELETE FROM users WHERE id = ?"),
    exportProjects: db.prepare("SELECT id, name, created_at, updated_at FROM projects WHERE owner_id = ? ORDER BY created_at"),
    exportTasks: db.prepare("SELECT id, project_id, title, status, due_on, created_at, updated_at FROM tasks WHERE owner_id = ? ORDER BY created_at"),
  };

  /** @param {string} userId @returns {{ token: string, maxAgeSeconds: number }} */
  function startSession(userId) {
    const token = newToken();
    const created = now();
    const expires = new Date(created.getTime() + sessionTtlHours * 3600_000);
    q.insertSession.run(newId("ses"), sha256(token), userId, created.toISOString(), expires.toISOString());
    return { token, maxAgeSeconds: sessionTtlHours * 3600 };
  }

  return {
    /** @param {{ email: string, password: string }} input */
    async signUp({ email, password }) {
      const passwordHash = await hashPassword(password);
      const id = newId("usr");
      try {
        q.insertUser.run(id, email, passwordHash, now().toISOString());
      } catch (err) {
        if (isUniqueViolation(err)) throw conflict("An account with this email already exists. Try signing in.", [{ field: "email", reason: "already_registered" }]);
        throw err;
      }
      const user = toUser(q.userById.get(id));
      return { user, session: startSession(id) };
    },

    /** Same error and similar timing whether the email exists or not (no account enumeration). @param {{ email: string, password: string }} input */
    async signIn({ email, password }) {
      const row = /** @type {any} */ (q.userByEmail.get(email));
      const ok = await verifyPassword(password, row ? String(row.password_hash) : DUMMY_PASSWORD_HASH);
      if (!row || !ok) throw unauthenticatedCredentials();
      return { user: toUser(row), session: startSession(String(row.id)) };
    },

    /** @param {string|undefined} token */
    signOut(token) {
      if (token) q.deleteSession.run(sha256(token));
    },

    /** @param {string|undefined} token @returns {User|null} */
    authenticate(token) {
      if (!token || token.length > 200) return null;
      const row = q.sessionUser.get(sha256(token), now().toISOString());
      return row ? toUser(row) : null;
    },

    /** Right to erasure: re-authenticate, then delete the user; FK cascades remove sessions, projects, tasks. @param {string} userId @param {string} password */
    async deleteAccount(userId, password) {
      const row = /** @type {any} */ (q.userById.get(userId));
      if (!row) throw unauthenticated();
      if (!(await verifyPassword(password, String(row.password_hash)))) {
        throw validationError([{ field: "password", reason: "incorrect_password" }]);
      }
      transaction(db, () => q.deleteUser.run(userId));
    },

    /** Right of access / portability: everything we store about the user, minus secrets. @param {string} userId */
    exportData(userId) {
      const row = q.userById.get(userId);
      if (!row) throw unauthenticated();
      return {
        exportedAt: now().toISOString(),
        user: toUser(row),
        projects: q.exportProjects.all(userId),
        tasks: q.exportTasks.all(userId),
      };
    },

    purgeExpiredSessions() {
      return Number(q.deleteExpired.run(now().toISOString()).changes);
    },
  };
}

function unauthenticatedCredentials() {
  const err = unauthenticated();
  err.code = "INVALID_CREDENTIALS";
  err.message = "That email and password combination is not correct.";
  return err;
}
