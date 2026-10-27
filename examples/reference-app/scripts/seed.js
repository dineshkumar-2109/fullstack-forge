// @ts-check
// Seed a demo account so the app is instantly explorable. Refuses to run in production.
import { loadConfig } from "../src/config.js";
import { migrate, openDatabase } from "../src/lib/db.js";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import { createProjectService } from "../src/modules/projects/projects.service.js";
import { createTaskService } from "../src/modules/tasks/tasks.service.js";

const config = loadConfig();
if (config.env === "production") {
  console.error("Refusing to seed a production database.");
  process.exit(1);
}
const db = openDatabase(config.databasePath);
migrate(db);
const now = () => new Date();
const auth = createAuthService({ db, now, sessionTtlHours: 1 });
const projects = createProjectService({ db, now });
const tasks = createTaskService({ db, now });

const email = "demo@tasklane.test";
const password = process.env.SEED_PASSWORD || "demo-password-123"; // secret-scan:allow (local demo only)
if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
  console.log(`Demo user already exists: ${email}`);
} else {
  const { user } = await auth.signUp({ email, password });
  const launch = projects.create(user.id, { name: "Website launch" });
  for (const [title, status, dueOn] of /** @type {const} */ ([
    ["Write homepage copy", "done", null], ["Pick a domain name", "doing", null], ["Set up analytics", "todo", "2030-01-15"],
  ])) tasks.create(user.id, launch.id, { title, status, dueOn });
  projects.create(user.id, { name: "Home renovation" });
  console.log(`Seeded demo user: ${email} / ${password}`);
}
db.close();
