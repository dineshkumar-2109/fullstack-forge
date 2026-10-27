// End-to-end story walkthrough in a real browser (Playwright). Each step mirrors a PRD acceptance criterion.
// Usage: BASE_URL=http://localhost:3000 node e2e/stories.e2e.mjs   (requires `playwright` + Chromium installed)
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch {
  console.error("Playwright is not installed: npm i -D playwright && npx playwright install chromium");
  process.exit(2);
}

const BASE = process.env.BASE_URL || "http://localhost:3000";
const email = `e2e-${Date.now()}@example.com`;
const password = "e2e password long enough";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("dialog", (d) => d.accept()); // confirm() prompts for destructive actions
const step = async (name, fn) => { await fn(); console.log(`PASS  ${name}`); };

try {
  await step("S-01 sign up from the landing page", async () => {
    await page.goto(BASE);
    await page.getByRole("link", { name: "Create your free account" }).click();
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/app");
    await page.getByText("Create your first project").waitFor();
  });

  await step("S-01 validation errors are shown next to fields", async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/signup`);
    await p.getByLabel("Email").fill("not-an-email");
    await p.getByLabel("Password").fill("short");
    await p.getByRole("button", { name: "Create account" }).click();
    await p.getByText("Enter a valid email address").waitFor();
    await p.getByText("Use at least 10 characters.").waitFor();
    await ctx.close();
  });

  await step("S-02 create a project", async () => {
    await page.getByLabel("New project name").fill("Launch week");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("heading", { name: "Launch week" }).waitFor();
  });

  await step("S-03 add tasks, one overdue", async () => {
    await page.getByLabel("Task", { exact: true }).fill("Write announcement");
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByText("Write announcement").waitFor();
    await page.getByLabel("Task", { exact: true }).fill("Book venue");
    await page.getByLabel("Due date (optional)").fill("2020-01-01");
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByText(/Overdue/).waitFor();
  });

  await step("S-04 move a task to done and filter", async () => {
    await page.getByLabel("Status for Write announcement").selectOption("done");
    await page.getByText("Task updated").waitFor();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByText("Write announcement").waitFor();
    assert.equal(await page.getByText("Book venue").count(), 0);
  });

  await step("S-05 stored XSS is rendered as text", async () => {
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByLabel("Task", { exact: true }).fill("<img src=x onerror=window.__xss=1>");
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByText("<img src=x onerror=window.__xss=1>").waitFor();
    assert.equal(await page.evaluate(() => window.__xss), undefined);
  });

  await step("S-06 export data and delete account", async () => {
    await page.getByRole("link", { name: "Settings" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download export" }).click();
    assert.match((await download).suggestedFilename(), /tasklane-export\.json/);
    await page.getByLabel("Confirm with your password").fill(password);
    await page.getByRole("button", { name: "Delete my account and data" }).click();
    await page.waitForURL(BASE + "/");
    await page.goto(`${BASE}/app`);
    await page.waitForURL("**/login");
  });

  assert.deepEqual(errors, [], `browser errors: ${errors.join(" | ")}`);
  console.log("\nE2E PASSED — all stories walked through the UI with zero browser errors");
} catch (err) {
  await page.screenshot({ path: "e2e-failure.png", fullPage: true }).catch(() => {});
  console.error(`\nE2E FAILED: ${err.message}\nScreenshot: e2e-failure.png`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
