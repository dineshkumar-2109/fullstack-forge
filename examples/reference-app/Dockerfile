# syntax=docker/dockerfile:1
# ---- deps: install dev tooling only for the check stage ----------------------------------
FROM node:22-alpine AS check
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run lint && npm run typecheck && npm test

# ---- runtime: zero runtime dependencies, non-root, read-only friendly --------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/tasklane.db
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts/migrate.js ./scripts/migrate.js
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
# Exec form so SIGTERM reaches Node and graceful shutdown runs.
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
