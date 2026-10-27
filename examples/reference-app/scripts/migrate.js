// @ts-check
// Apply pending migrations and exit. Run before starting a new release (see docs/runbook.md).
import { loadConfig } from "../src/config.js";
import { migrate, openDatabase } from "../src/lib/db.js";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const applied = migrate(db);
console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date.");
db.close();
