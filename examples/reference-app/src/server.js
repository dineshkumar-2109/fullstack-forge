// @ts-check
import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { createLogger } from "./lib/logger.js";
import { migrate, openDatabase } from "./lib/db.js";
import { createApp } from "./app.js";

let config;
try {
  config = loadConfig();
} catch (err) {
  // Fail fast with a readable message — never start half-configured.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const logger = createLogger({ level: config.logLevel });
const db = openDatabase(config.databasePath);
const applied = migrate(db);
if (applied.length) logger.info("migrations_applied", { migrations: applied });

const app = createApp({ config, db, logger });
const server = createServer((req, res) => {
  app.handle(req, res).catch((err) => {
    logger.error("handler_crash", { err });
    if (!res.headersSent) res.writeHead(500).end();
  });
});
server.requestTimeout = 30_000;   // whole request
server.headersTimeout = 10_000;   // slowloris protection
server.keepAliveTimeout = 5_000;

// Housekeeping: purge expired sessions hourly (single instance; use a scheduled job when scaled out).
const purge = setInterval(() => {
  try { logger.info("sessions_purged", { count: app.auth.purgeExpiredSessions() }); } catch (err) { logger.error("session_purge_failed", { err }); }
}, 3600_000);
purge.unref();

server.listen(config.port, config.host, () => {
  const addr = server.address();
  logger.info("server_started", { env: config.env, port: typeof addr === "object" && addr ? addr.port : config.port });
});

/** Graceful shutdown: fail readiness, stop accepting, drain in-flight requests, close the DB. @param {string} signal */
function shutdown(signal) {
  logger.info("shutdown_started", { signal });
  app.beginShutdown();
  clearInterval(purge);
  const force = setTimeout(() => {
    logger.error("shutdown_forced", { reason: "drain timeout" });
    process.exit(1);
  }, 10_000);
  force.unref();
  server.close(() => {
    db.close();
    logger.info("shutdown_complete");
    process.exit(0);
  });
  server.closeIdleConnections();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => logger.error("unhandled_rejection", { reason: String(reason) }));
