// @ts-check
import { object, string } from "../../lib/validation.js";
import { decodeCursor, parseLimit } from "../../lib/http.js";
import { unauthenticated } from "../../lib/errors.js";

const projectSchema = object({ name: string({ min: 1, max: 80 }) });

/** @param {import('../../lib/http.js').Ctx} ctx */
const actor = (ctx) => {
  if (!ctx.user) throw unauthenticated();
  return ctx.user;
};

/**
 * @param {import('../../lib/http.js').Router} router
 * @param {{ projects: ReturnType<typeof import('./projects.service.js').createProjectService> }} deps
 */
export function registerProjectRoutes(router, { projects }) {
  router.add("GET", "/api/projects", async (ctx) => {
    const page = projects.list(actor(ctx).id, { cursor: decodeCursor(ctx.query.get("cursor")), limit: parseLimit(ctx.query) });
    return { status: 200, body: page };
  });
  router.add("POST", "/api/projects", async (ctx) => {
    const user = actor(ctx);
    return { status: 201, body: { project: projects.create(user.id, projectSchema(await ctx.body())) } };
  });
  router.add("GET", "/api/projects/:projectId", async (ctx) => {
    return { status: 200, body: { project: projects.get(actor(ctx).id, ctx.params.projectId) } };
  });
  router.add("PATCH", "/api/projects/:projectId", async (ctx) => {
    const user = actor(ctx);
    return { status: 200, body: { project: projects.rename(user.id, ctx.params.projectId, projectSchema(await ctx.body())) } };
  });
  router.add("DELETE", "/api/projects/:projectId", async (ctx) => {
    projects.remove(actor(ctx).id, ctx.params.projectId);
    return { status: 204 };
  });
}
