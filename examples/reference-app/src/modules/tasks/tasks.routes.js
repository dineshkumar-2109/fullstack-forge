// @ts-check
import { integer, isoDate, nullable, object, oneOf, optional, string } from "../../lib/validation.js";
import { badRequest, unauthenticated } from "../../lib/errors.js";
import { decodeCursor, parseLimit } from "../../lib/http.js";
import { TASK_STATUSES } from "./tasks.service.js";

const createSchema = object({
  title: string({ min: 1, max: 200 }),
  status: optional(oneOf(TASK_STATUSES)),
  dueOn: optional(nullable(isoDate())),
});
const updateSchema = object({
  version: integer({ min: 1 }),
  title: optional(string({ min: 1, max: 200 })),
  status: optional(oneOf(TASK_STATUSES)),
  dueOn: optional(nullable(isoDate())),
});

/** @param {import('../../lib/http.js').Ctx} ctx */
const actor = (ctx) => {
  if (!ctx.user) throw unauthenticated();
  return ctx.user;
};

/**
 * @param {import('../../lib/http.js').Router} router
 * @param {{ tasks: ReturnType<typeof import('./tasks.service.js').createTaskService> }} deps
 */
export function registerTaskRoutes(router, { tasks }) {
  router.add("GET", "/api/projects/:projectId/tasks", async (ctx) => {
    const rawStatus = ctx.query.get("status");
    if (rawStatus !== null && !TASK_STATUSES.includes(/** @type {any} */ (rawStatus))) {
      throw badRequest(`status must be one of ${TASK_STATUSES.join(", ")}.`);
    }
    const page = tasks.list(actor(ctx).id, ctx.params.projectId, {
      status: /** @type {any} */ (rawStatus),
      cursor: decodeCursor(ctx.query.get("cursor")),
      limit: parseLimit(ctx.query, 50, 200),
    });
    return { status: 200, body: page };
  });
  router.add("POST", "/api/projects/:projectId/tasks", async (ctx) => {
    const user = actor(ctx);
    return { status: 201, body: { task: tasks.create(user.id, ctx.params.projectId, createSchema(await ctx.body())) } };
  });
  router.add("PATCH", "/api/tasks/:taskId", async (ctx) => {
    const user = actor(ctx);
    return { status: 200, body: { task: tasks.update(user.id, ctx.params.taskId, updateSchema(await ctx.body())) } };
  });
  router.add("DELETE", "/api/tasks/:taskId", async (ctx) => {
    tasks.remove(actor(ctx).id, ctx.params.taskId);
    return { status: 204 };
  });
}
