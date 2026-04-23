FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml ./
COPY apps/gpx-web/package.json apps/gpx-web/package.json
COPY apps/gpx-console/package.json apps/gpx-console/package.json
COPY apps/gpx-exporter/package.json apps/gpx-exporter/package.json
COPY packages/gpx-core/package.json packages/gpx-core/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=9080

COPY --from=builder /app/apps/gpx-web/.next/standalone ./apps/gpx-web/.next/standalone
COPY --from=builder /app/apps/gpx-web/.next/static ./apps/gpx-web/.next/static
COPY --from=builder /app/apps/gpx-web/public ./apps/gpx-web/public

EXPOSE 9080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- "http://127.0.0.1:9080/api/health" || exit 1

CMD ["node", "apps/gpx-web/.next/standalone/server.js"]