#!/usr/bin/env node
/**
 * Real-browser smoke test (Playwright / Chromium).
 *
 * Usage:
 *   node smoke_test.mjs --base-url http://localhost:3000 --paths / /login /app \
 *     [--not-found /this-should-404] [--out .autobuild/screenshots] \
 *     [--login-path /login --email user@example.com --password '...' ] \
 *     [--storage-state state.json] [--timeout 20000]
 *
 * For every path, at desktop (1280x800) and mobile (375x812) it checks:
 *   - main document HTTP status < 400 (or 404 for --not-found paths)
 *   - no console errors and no uncaught page errors
 *   - no failed sub-requests (network failure or HTTP >= 400)
 *   - no horizontal overflow
 *   - no placeholder/garbage text (lorem ipsum, undefined, NaN, [object Object])
 * and saves a full-page screenshot. Writes smoke-report.json and smoke-report.md to --out.
 * Exit code 1 if any check fails. Requires the `playwright` package (Chromium installed).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
let chromium;
for (const mod of ["playwright", "@playwright/test", "playwright-core"]) {
  try { ({ chromium } = require(mod)); break; } catch { /* try next */ }
}
if (!chromium) {
  console.error("smoke_test: Playwright is not installed. Install with `npm i -D playwright && npx playwright install chromium`.");
  process.exit(2);
}

function parseArgs(argv) {
  const opts = { paths: [], notFound: [], out: ".autobuild/screenshots", timeout: 20000 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => argv[++i];
    if (a === "--base-url") opts.baseUrl = take();
    else if (a === "--paths") { while (argv[i + 1] && !argv[i + 1].startsWith("--")) opts.paths.push(take()); }
    else if (a === "--not-found") { while (argv[i + 1] && !argv[i + 1].startsWith("--")) opts.notFound.push(take()); }
    else if (a === "--out") opts.out = take();
    else if (a === "--login-path") opts.loginPath = take();
    else if (a === "--email") opts.email = take();
    else if (a === "--password") opts.password = take();
    else if (a === "--storage-state") opts.storageState = take();
    else if (a === "--timeout") opts.timeout = Number(take());
  }
  if (!opts.baseUrl) { console.error("smoke_test: --base-url is required"); process.exit(2); }
  if (opts.paths.length === 0) opts.paths = ["/"];
  return opts;
}

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
];
const GARBAGE = /\blorem ipsum\b|\bundefined\b|\bNaN\b|\[object Object\]/i;

async function login(page, opts) {
  await page.goto(new URL(opts.loginPath, opts.baseUrl).href, { waitUntil: "networkidle", timeout: opts.timeout });
  await page.locator('input[type="email"], input[name="email"]').first().fill(opts.email);
  await page.locator('input[type="password"]').first().fill(opts.password);
  await Promise.all([
    page.waitForLoadState("networkidle").catch(() => {}),
    page.locator('input[type="password"]').first().press("Enter"),
  ]);
  await page.waitForTimeout(500);
}

async function checkPath(browser, opts, vp, path, expect404) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch,
    ...(opts.storageState ? { storageState: opts.storageState } : {}),
  });
  const page = await context.newPage();
  const problems = [];
  const url = new URL(path, opts.baseUrl).href;
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (expect404 && /status of 404/.test(text)) return;
    problems.push(`console error: ${text.slice(0, 300)}`);
  });
  page.on("pageerror", (err) => problems.push(`uncaught page error: ${String(err.message || err).slice(0, 300)}`));
  page.on("requestfailed", (req) => {
    const reason = req.failure()?.errorText || "failed";
    if (!/ERR_ABORTED/.test(reason)) problems.push(`request failed: ${req.method()} ${req.url()} (${reason})`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400 && res.url() !== url && !(expect404 && res.status() === 404)) {
      problems.push(`HTTP ${res.status()} for sub-request ${res.request().method()} ${res.url()}`);
    }
  });

  if (opts.loginPath && opts.email && opts.password && !opts.storageState) await login(page, opts);

  let status = 0;
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: opts.timeout });
    status = res ? res.status() : 0;
  } catch (e) {
    problems.push(`navigation failed: ${e.message.split("\n")[0]}`);
  }
  if (expect404 ? status !== 404 : (status === 0 || status >= 400)) {
    problems.push(`document status ${status} (expected ${expect404 ? "404" : "< 400"})`);
  }
  await page.waitForTimeout(300);
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    text: document.body ? document.body.innerText : "",
    title: document.title,
  })).catch(() => ({ scrollWidth: 0, clientWidth: 0, text: "", title: "" }));
  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    problems.push(`horizontal overflow: content ${metrics.scrollWidth}px > viewport ${metrics.clientWidth}px`);
  }
  const garbage = metrics.text.match(GARBAGE);
  if (garbage) problems.push(`placeholder/garbage text visible: "${garbage[0]}"`);
  if (!metrics.title) problems.push("page has no <title>");

  const safe = path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
  const shot = join(opts.out, `${safe}.${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true }).catch((e) => problems.push(`screenshot failed: ${e.message}`));
  await context.close();
  return { path, viewport: vp.name, status, title: metrics.title, screenshot: shot, problems: [...new Set(problems)] };
}

const opts = parseArgs(process.argv.slice(2));
mkdirSync(opts.out, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const path of [...opts.paths, ...opts.notFound]) {
    for (const vp of VIEWPORTS) {
      const r = await checkPath(browser, opts, vp, path, opts.notFound.includes(path));
      results.push(r);
      console.log(`${r.problems.length ? "FAIL" : "PASS"}  ${vp.name.padEnd(7)} ${path}  (HTTP ${r.status})`);
      for (const p of r.problems) console.log(`      - ${p}`);
    }
  }
} finally {
  await browser.close();
}
const failed = results.filter((r) => r.problems.length);
const report = { baseUrl: opts.baseUrl, time: new Date().toISOString(), passed: failed.length === 0, results };
writeFileSync(join(opts.out, "smoke-report.json"), JSON.stringify(report, null, 2));
const md = [
  `# Smoke test — ${report.time}`, "", `Base URL: ${opts.baseUrl}`, "",
  `**Result: ${report.passed ? "PASS" : "FAIL"}** (${results.length - failed.length}/${results.length} page-views clean)`, "",
  "| Path | Viewport | HTTP | Problems | Screenshot |", "|---|---|---|---|---|",
  ...results.map((r) => `| ${r.path} | ${r.viewport} | ${r.status} | ${r.problems.length ? r.problems.join("<br>") : "none"} | ${r.screenshot} |`),
  "", "Next: open each screenshot and apply the visual checklist (references/19-ui-ux-quality.md §7).",
];
writeFileSync(join(opts.out, "smoke-report.md"), md.join("\n") + "\n");
console.log(`\n${report.passed ? "SMOKE PASSED" : "SMOKE FAILED"} — report: ${resolve(opts.out, "smoke-report.md")}`);
process.exit(report.passed ? 0 : 1);
