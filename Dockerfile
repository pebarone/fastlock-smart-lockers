FROM oven/bun:1.3.12-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

COPY frontend/ ./
RUN bun run build

FROM oven/bun:1.3.12-alpine AS backend-builder
WORKDIR /app/backend

COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile

COPY backend/ ./
RUN bun run build

FROM oven/bun:1.3.12-alpine AS backend-deps
WORKDIR /app/backend

COPY backend/package.json backend/bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.3.12-alpine AS runtime
WORKDIR /app/backend

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3333

COPY --chown=bun:bun --from=backend-builder /app/backend/dist ./dist
COPY --chown=bun:bun --from=backend-deps /app/backend/node_modules ./node_modules
COPY --chown=bun:bun backend/openapi.yaml ./openapi.yaml
COPY --chown=bun:bun --from=frontend-builder /app/frontend/dist ./public

USER bun
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["bun", "-e", "const port = process.env.PORT || '3333'; const response = await fetch('http://127.0.0.1:' + port + '/api/health'); if (!response.ok) { throw new Error('unhealthy'); }"]

CMD ["bun", "dist/server.js"]
