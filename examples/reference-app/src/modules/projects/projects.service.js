// @ts-check
import { conflict, notFound } from "../../lib/errors.js";
import { isUniqueViolation } from "../../lib/db.js";
import { encodeCursor } from "../../lib/http.js";
import { newId } from "../../lib/security.js";

/**
 * @typedef {{ id: string, name: string, taskCount: number, openTaskCount: number, createdAt: string, updatedAt: string }} ProjectDto
 */

/** @param {any} row @returns {ProjectDto} */
const toDto = (row) => ({
  id: String(row.id), name: String(row.name),
  taskCount: Number(row.task_count ?? 0), openTaskCount: Number(row.open_task_count ?? 0),
  createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const SELECT = `
  SELECT p.id, p.name, p.created_at, p.updated_at,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_task_count
  FROM projects p`;

/**
 * Every statement is scoped by owner_id taken from the authenticated session — never from the request.
 * @param {{ db: import('node:sqlite').DatabaseSync, now: () => Date }} deps
 */
export function createProjectService({ db, now }) {
  const q = {
    firstPage: db.prepare(`${SELECT} WHERE p.owner_id = ? ORDER BY p.created_at DESC, p.id DESC LIMIT ?`),
    nextPage: db.prepare(`${SELECT} WHERE p.owner_id = ? AND (p.created_at < ? OR (p.created_at = ? AND p.id < ?)) ORDER BY p.created_at DESC, p.id DESC LIMIT ?`),
    byId: db.prepare(`${SELECT} WHERE p.owner_id = ? AND p.id = ?`),
    insert: db.prepare("INSERT INTO projects (id, owner_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"),
    rename: db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE owner_id = ? AND id = ?"),
    remove: db.prepare("DELETE FROM projects WHERE owner_id = ? AND id = ?"),
  };

  /** @param {unknown} err */
  const mapUnique = (err) => isUniqueViolation(err) ? conflict("You already have a project with that name.", [{ field: "name", reason: "already_exists" }]) : err;

  return {
    /** @param {string} ownerId @param {{ cursor: { createdAt: string, id: string } | null, limit: number }} page */
    list(ownerId, { cursor, limit }) {
      const rows = cursor
        ? q.nextPage.all(ownerId, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
        : q.firstPage.all(ownerId, limit + 1);
      const items = rows.slice(0, limit).map(toDto);
      const nextCursor = rows.length > limit ? encodeCursor(items[items.length - 1]) : null;
      return { items, nextCursor };
    },

    /** @param {string} ownerId @param {string} id */
    get(ownerId, id) {
      const row = q.byId.get(ownerId, id);
      if (!row) throw notFound("Project"); // same answer for "doesn't exist" and "not yours"
      return toDto(row);
    },

    /** @param {string} ownerId @param {{ name: string }} input */
    create(ownerId, { name }) {
      const id = newId("prj");
      const ts = now().toISOString();
      try {
        q.insert.run(id, ownerId, name, ts, ts);
      } catch (err) { throw mapUnique(err); }
      return this.get(ownerId, id);
    },

    /** @param {string} ownerId @param {string} id @param {{ name: string }} input */
    rename(ownerId, id, { name }) {
      let changes;
      try {
        changes = q.rename.run(name, now().toISOString(), ownerId, id).changes;
      } catch (err) { throw mapUnique(err); }
      if (Number(changes) === 0) throw notFound("Project");
      return this.get(ownerId, id);
    },

    /** @param {string} ownerId @param {string} id */
    remove(ownerId, id) {
      if (Number(q.remove.run(ownerId, id).changes) === 0) throw notFound("Project");
    },
  };
}
