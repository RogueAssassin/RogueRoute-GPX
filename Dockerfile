# rogueroute-gpx: one image with the website, OSRM and the region supervisor.
#
# The runtime starts from the official OSRM image, so osrm-routed, osrm-extract,
# osrm-partition, osrm-customize, their libraries and the routing profiles in /opt come
# straight from upstream (BSD-2-Clause). Node is copied in from the matching Debian
# (trixie) Node image; it only needs glibc and libstdc++, which the OSRM image ships.

ARG NODE_IMAGE=node:26.8.1-trixie-slim
ARG OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:v26.7.3-debian

FROM ${NODE_IMAGE} AS node

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV CI=true
RUN npm install --global pnpm@11.24.0

FROM base AS deps
COPY package.json pnpm-workspace.yaml tsconfig.base.json pnpm-lock.yaml ./
COPY apps/gpx-web/package.json apps/gpx-web/package.json
COPY apps/gpx-console/package.json apps/gpx-console/package.json
COPY apps/gpx-exporter/package.json apps/gpx-exporter/package.json
COPY packages/gpx-core/package.json packages/gpx-core/package.json
RUN pnpm install --no-frozen-lockfile

FROM base AS builder
COPY --from=deps /app ./
COPY . .
ARG NEXT_PUBLIC_BUILD_TIME
ARG NEXT_PUBLIC_APP_VERSION
ENV NEXT_PUBLIC_BUILD_TIME=$NEXT_PUBLIC_BUILD_TIME
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
ENV NEXT_TELEMETRY_DISABLED=1
RUN set -eux; \
    find node_modules/.bin apps packages -path '*node_modules/.bin/*' -exec chmod +x {} + 2>/dev/null || true; \
    pnpm build

FROM ${OSRM_IMAGE} AS runner
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=9080 \
    ROGUEROUTE_DATA_DIR=/data \
    ROGUEROUTE_REGIONS_FILE=/app/regions.json \
    ROGUEROUTE_WEB_ENTRY=/app/apps/gpx-web/server.js \
    ROGUEROUTE_CONTROL_SOCKET=/tmp/rogueroute-gpx.sock \
    OSRM_BIN_DIR=/usr/local/bin \
    OSRM_PROFILES_DIR=/opt

COPY --from=builder /app/apps/gpx-web/.next/standalone ./
COPY --from=builder /app/apps/gpx-web/.next/static ./apps/gpx-web/.next/static
COPY --from=builder /app/apps/gpx-web/public ./apps/gpx-web/public
COPY apps/gpx-web/supervisor/*.mjs ./supervisor/
COPY regions.json ./regions.json
RUN set -eux; \
    rm -f ./supervisor/*.test.mjs; \
    printf '#!/bin/sh\nexec node /app/supervisor/cli.mjs "$@"\n' > /usr/local/bin/rogueroute-gpx; \
    chmod 0755 /usr/local/bin/rogueroute-gpx; \
    install -d -m 0777 /data; \
    node --version; \
    osrm-routed --version

# Map data and the saved active region live in /data (bind-mount OSRM_DATA_DIR there).
VOLUME ["/data"]
USER 1000:1000
EXPOSE 9080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:9080/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
ENTRYPOINT ["node", "/app/supervisor/main.mjs"]
