// @ts-check
import { conflict, notFound } from "../../lib/errors.js";
import { transaction } from "../../lib/db.js";
import { encodeCursor } from "../../lib/http.js";
import { newId } from "../../lib/security.js";

export const TASK_STATUSES = /** @type {const} */ (["todo", "doing", "done"]);

/**
 * @typedef {typeof TASK_STATUSES[number]} TaskStatus
 * @typedef {{ id: string, projectId: string, title: string, status: TaskStatus, dueOn: string|null, version: number, createdAt: string, updatedAt: string }} TaskDto
 */

/** @param {any} row @returns {TaskDto} */
const toDto = (row) => ({
  id: String(row.id), projectId: String(row.project_id), title: String(row.title), status: row.status,
  dueOn: row.due_on === null ? null : String(row.due_on), version: Number(row.version),
  createdAt: String(row.created_at), updatedAt: String(row.updated_at),
});

const COLS = "id, project_id, title, status, due_on, version, created_at, updated_at";

/** @param {{ db: import('node:sqlite').DatabaseSync, now: () => Date }} deps */
export function createTaskService({ db, now }) {
  const q = {
    projectOwned: db.prepare("SELECT 1 FROM projects WHERE owner_id = ? AND id = ?"),
    page: db.prepare(`SELECT ${COLS} FROM tasks WHERE owner_id = ? AND project_id = ?
      AND (? IS NULL OR status = ?)
      AND (? IS NULL OR created_at < ? OR (created_at = ? AND id < ?))
      ORDER BY created_at DESC, id DESC LIMIT ?`),
    byId: db.prepare(`SELECT ${COLS} FROM tasks WHERE owner_id = ? AND id = ?`),
    insert: db.prepare("INSERT INTO tasks (id, project_id, owner_id, title, status, due_on, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"),
    update: db.prepare(`UPDATE tasks SET title = ?, status = ?, due_on = ?, version = version + 1, updated_at = ?
      WHERE owner_id = ? AND id = ? AND version = ?`),
    touchProject: db.prepare("UPDATE projects SET updated_at = ? WHERE owner_id = ? AND id = ?"),
    remove: db.prepare("DELETE FROM tasks WHERE owner_id = ? AND id = ?"),
  };

  /** @param {string} ownerId @param {string} projectId */
  const requireProject = (ownerId, projectId) => {
    if (!q.projectOwned.get(ownerId, projectId)) throw notFound("Project");
  };

  return {
    /**
     * @param {string} ownerId @param {string} projectId
     * @param {{ status: TaskStatus|null, cursor: { createdAt: string, id: string } | null, limit: number }} opts
     */
    list(ownerId, projectId, { status, cursor, limit }) {
      requireProject(ownerId, projectId);
      const c = cursor ?? { createdAt: null, id: null };
      const rows = q.page.all(ownerId, projectId, status, status, c.createdAt, c.createdAt, c.createdAt, c.id, limit + 1);
      const items = rows.slice(0, limit).map(toDto);
      return { items, nextCursor: rows.length > limit ? encodeCursor(items[items.length - 1]) : null };
    },

    /** @param {string} ownerId @param {string} projectId @param {{ title: string, status?: TaskStatus, dueOn?: string|null }} input */
    create(ownerId, projectId, input) {
      requireProject(ownerId, projectId);
      const id = newId("tsk");
      const ts = now().toISOString();
      transaction(db, () => {
        q.insert.run(id, projectId, ownerId, input.title, input.status ?? "todo", input.dueOn ?? null, ts, ts);
        q.touchProject.run(ts, ownerId, projectId);
      });
      return toDto(q.byId.get(ownerId, id));
    },

    /**
     * Optimistic concurrency: the client sends the version it last saw; a stale version gets 409
     * instead of silently overwriting someone else's (or another tab's) change.
     * @param {string} ownerId @param {string} id
     * @param {{ version: number, title?: string, status?: TaskStatus, dueOn?: string|null }} patch
     */
    update(ownerId, id, patch) {
      const current = q.byId.get(ownerId, id);
      if (!current) throw notFound("Task");
      const task = toDto(current);
      const next = {
        title: patch.title ?? task.title,
        status: patch.status ?? task.status,
        dueOn: patch.dueOn === undefined ? task.dueOn : patch.dueOn,
      };
      const ts = now().toISOString();
      const changed = transaction(db, () => {
        const res = q.update.run(next.title, next.status, next.dueOn, ts, ownerId, id, patch.version);
        if (Number(res.changes) === 1) q.touchProject.run(ts, ownerId, task.projectId);
        return Number(res.changes);
      });
      if (changed === 0) {
        throw conflict("This task was changed somewhere else. Reload to see the latest version.", [{ field: "version", reason: "stale_version" }]);
      }
      return toDto(q.byId.get(ownerId, id));
    },

    /** @param {string} ownerId @param {string} id */
    remove(ownerId, id) {
      if (Number(q.remove.run(ownerId, id).changes) === 0) throw notFound("Task");
    },
  };
}
