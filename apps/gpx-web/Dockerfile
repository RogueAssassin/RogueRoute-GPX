FROM node:24.18.0-alpine AS base
WORKDIR /app
ENV CI=true
RUN corepack enable && corepack prepare pnpm@11.12.0 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY pnpm-lock.yaml ./
COPY apps/gpx-web/package.json apps/gpx-web/package.json
COPY apps/gpx-console/package.json apps/gpx-console/package.json
COPY apps/gpx-exporter/package.json apps/gpx-exporter/package.json
COPY packages/gpx-core/package.json packages/gpx-core/package.json
RUN set -eux; \
    pnpm install --frozen-lockfile; \
    chmod +x node_modules/.bin/* 2>/dev/null || true

FROM base AS builder
COPY --from=deps /app ./
COPY . .
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ARG NEXT_PUBLIC_BUILD_TIME
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_PUBLIC_BUILD_TIME=$NEXT_PUBLIC_BUILD_TIME
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
RUN set -eux; \
    chmod +x node_modules/.bin/* 2>/dev/null || true; \
    find apps packages -path '*/node_modules/.bin/*' -exec chmod +x {} + 2>/dev/null || true; \
    pnpm build

FROM node:24.18.0-alpine AS runner
WORKDIR /app
RUN apk add --no-cache docker-cli docker-cli-compose wget
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=9080

COPY --from=builder /app/apps/gpx-web/.next/standalone ./
COPY --from=builder /app/apps/gpx-web/.next/static ./apps/gpx-web/.next/static
COPY --from=builder /app/apps/gpx-web/public ./apps/gpx-web/public
COPY --from=builder /app/apps/gpx-web/manager ./manager

EXPOSE 9080

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 CMD wget -qO- "http://127.0.0.1:9080/api/health" || exit 1

CMD ["node", "apps/gpx-web/server.js"]
