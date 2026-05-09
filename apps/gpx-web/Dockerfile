FROM node:24.15.0-alpine AS base
WORKDIR /app
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.0.8 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml ./
COPY apps/gpx-web/package.json apps/gpx-web/package.json
COPY apps/gpx-console/package.json apps/gpx-console/package.json
COPY apps/gpx-exporter/package.json apps/gpx-exporter/package.json
COPY packages/gpx-core/package.json packages/gpx-core/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:24.15.0-alpine AS runner
WORKDIR /app
RUN apk add --no-cache bash docker-cli docker-cli-compose wget
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=9080

COPY --from=builder /app/apps/gpx-web/.next/standalone ./
COPY --from=builder /app/apps/gpx-web/.next/static ./apps/gpx-web/.next/static
COPY --from=builder /app/apps/gpx-web/public ./apps/gpx-web/public

EXPOSE 9080

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 CMD wget -qO- "http://127.0.0.1:9080/api/health" || exit 1

CMD ["node", "apps/gpx-web/server.js"]
