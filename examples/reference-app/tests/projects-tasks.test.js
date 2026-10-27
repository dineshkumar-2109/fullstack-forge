import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startTestApp } from "./helpers.js";

describe("projects and tasks (core loop)", () => {
  let t, alice;
  before(async () => {
    t = await startTestApp();
    alice = t.client();
    await alice.signUp("alice@example.com");
  });
  after(async () => { await t.close(); });

  test("create → list → get → rename → delete a project", async () => {
    const created = await alice.post("/api/projects", { name: "  Website launch  " });
    assert.equal(created.status, 201);
    assert.equal(created.body.project.name, "Website launch");
    assert.match(created.body.project.id, /^prj_[A-Za-z0-9_-]{16}$/, "IDs are opaque and unguessable");
    const id = created.body.project.id;

    const list = await alice.get("/api/projects");
    assert.ok(list.body.items.some((p) => p.id === id));

    const renamed = await alice.patch(`/api/projects/${id}`, { name: "Website relaunch" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.project.name, "Website relaunch");

    assert.equal((await alice.delete(`/api/projects/${id}`)).status, 204);
    assert.equal((await alice.get(`/api/projects/${id}`)).status, 404);
  });

  test("project names are unique per user (case-insensitive) → 409", async () => {
    await alice.post("/api/projects", { name: "Taxes" });
    const dupe = await alice.post("/api/projects", { name: "TAXES" });
    assert.equal(dupe.status, 409);
    assert.equal(dupe.body.error.details[0].field, "name");
    const other = t.client();
    await other.signUp();
    assert.equal((await other.post("/api/projects", { name: "Taxes" })).status, 201, "another user may reuse the name");
  });

  test("tasks: create with defaults, filter by status, counts on the project", async () => {
    const { body: { project } } = await alice.post("/api/projects", { name: "Garden" });
    const a = await alice.post(`/api/projects/${project.id}/tasks`, { title: "Buy seeds" });
    assert.equal(a.status, 201);
    assert.equal(a.body.task.status, "todo");
    assert.equal(a.body.task.version, 1);
    assert.equal(a.body.task.dueOn, null);
    await alice.post(`/api/projects/${project.id}/tasks`, { title: "Dig beds", status: "done", dueOn: "2030-03-01" });

    const done = await alice.get(`/api/projects/${project.id}/tasks?status=done`);
    assert.deepEqual(done.body.items.map((x) => x.title), ["Dig beds"]);
    const p = await alice.get(`/api/projects/${project.id}`);
    assert.equal(p.body.project.taskCount, 2);
    assert.equal(p.body.project.openTaskCount, 1);

    assert.equal((await alice.get(`/api/projects/${project.id}/tasks?status=bogus`)).status, 400);
  });

  test("task validation: impossible dates, empty titles, bad status", async () => {
    const { body: { project } } = await alice.post("/api/projects", { name: "Validation" });
    const res = await alice.post(`/api/projects/${project.id}/tasks`, { title: "   ", status: "later", dueOn: "2030-02-30" });
    assert.equal(res.status, 400);
    const reasons = Object.fromEntries(res.body.error.details.map((d) => [d.field, d.reason]));
    assert.equal(reasons.title, "required");
    assert.match(reasons.status, /^must_be_one_of/);
    assert.equal(reasons.dueOn, "invalid_date");
  });

  test("optimistic concurrency: a stale version gets 409 and does not overwrite", async () => {
    const { body: { project } } = await alice.post("/api/projects", { name: "Concurrency" });
    const { body: { task } } = await alice.post(`/api/projects/${project.id}/tasks`, { title: "Original" });
    const first = await alice.patch(`/api/tasks/${task.id}`, { version: 1, status: "doing" });
    assert.equal(first.status, 200);
    assert.equal(first.body.task.version, 2);
    const stale = await alice.patch(`/api/tasks/${task.id}`, { version: 1, title: "Overwrite attempt" });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.details[0].reason, "stale_version");
    const list = await alice.get(`/api/projects/${project.id}/tasks`);
    assert.equal(list.body.items[0].title, "Original");
    assert.equal(list.body.items[0].status, "doing");
  });

  test("clearing a due date with null, and empty PATCH bodies need a version", async () => {
    const { body: { project } } = await alice.post("/api/projects", { name: "Dates" });
    const { body: { task } } = await alice.post(`/api/projects/${project.id}/tasks`, { title: "Has date", dueOn: "2030-05-05" });
    const cleared = await alice.patch(`/api/tasks/${task.id}`, { version: 1, dueOn: null });
    assert.equal(cleared.body.task.dueOn, null);
    assert.equal((await alice.patch(`/api/tasks/${task.id}`, {})).status, 400);
  });

  test("deleting a project cascades to its tasks", async () => {
    const { body: { project } } = await alice.post("/api/projects", { name: "Cascade" });
    const { body: { task } } = await alice.post(`/api/projects/${project.id}/tasks`, { title: "Child" });
    await alice.delete(`/api/projects/${project.id}`);
    assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE id = ?").get(task.id).n, 0);
  });

  test("cursor pagination returns every item exactly once, newest first", async () => {
    const c = t.client();
    await c.signUp();
    const names = [];
    for (let i = 0; i < 7; i++) {
      t.tick(1000);
      names.push(`P${i}`);
      await c.post("/api/projects", { name: `P${i}` });
    }
    const seen = [];
    let cursor = null;
    let pages = 0;
    do {
      const res = await c.get(`/api/projects?limit=3${cursor ? `&cursor=${cursor}` : ""}`);
      assert.equal(res.status, 200);
      seen.push(...res.body.items.map((p) => p.name));
      cursor = res.body.nextCursor;
      pages++;
    } while (cursor && pages < 10);
    assert.equal(pages, 3);
    assert.deepEqual(seen, names.reverse());
  });

  test("pagination input is validated", async () => {
    assert.equal((await alice.get("/api/projects?limit=0")).status, 400);
    assert.equal((await alice.get("/api/projects?limit=1000")).status, 400);
    assert.equal((await alice.get("/api/projects?cursor=not-a-cursor")).status, 400);
  });
});
