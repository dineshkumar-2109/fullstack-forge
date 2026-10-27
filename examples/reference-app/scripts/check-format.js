// @ts-check
// Dependency-free formatting check: final newline, no trailing whitespace, no tabs, LF line endings.
// (In a larger project use Prettier/Biome; this keeps the reference app at zero runtime deps.)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = ["src", "public", "tests", "scripts", "migrations", "e2e", "docs"];
const EXT = new Set([".js", ".css", ".html", ".sql", ".svg", ".md"]);
/** @type {string[]} */
const problems = [];
/** @param {string} dir */
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!EXT.has(extname(p))) continue;
    const text = readFileSync(p, "utf8");
    if (text.includes("\r\n")) problems.push(`${p}: CRLF line endings`);
    if (!text.endsWith("\n")) problems.push(`${p}: missing final newline`);
    text.split("\n").forEach((line, i) => {
      if (/[ \t]+$/.test(line)) problems.push(`${p}:${i + 1}: trailing whitespace`);
      if (line.includes("\t")) problems.push(`${p}:${i + 1}: tab character`);
    });
  }
}
ROOTS.forEach(walk);
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} formatting problem(s).`);
  process.exit(1);
}
console.log("Formatting OK.");
