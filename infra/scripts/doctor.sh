#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
pass() { echo "[PASS] $*"; }
issue() { echo "[WARN] $*"; }
command -v docker >/dev/null 2>&1 && pass "docker is installed" || issue "docker is not installed"
docker info >/dev/null 2>&1 && pass "docker daemon is running" || issue "docker daemon is not responding"
docker compose version >/dev/null 2>&1 && pass "docker compose is available" || issue "docker compose is not available"
if command -v node >/dev/null 2>&1; then
  node_version="$(node -v 2>/dev/null || true)"
  [[ "$node_version" == "v$EXPECTED_NODE_VERSION" ]] && pass "Node.js $node_version matches supported standard" || issue "Node.js $EXPECTED_NODE_VERSION is supported. Detected: ${node_version:-unknown}"
else issue "Node.js is not installed"; fi
if command -v pnpm >/dev/null 2>&1; then
  pnpm_version="$(pnpm -v 2>/dev/null || echo unknown)"
  [[ "$pnpm_version" == "$EXPECTED_PNPM_VERSION" ]] && pass "pnpm $pnpm_version matches supported standard" || issue "pnpm $EXPECTED_PNPM_VERSION is supported. Detected: ${pnpm_version:-unknown}"
else issue "pnpm is not installed or not activated yet"; fi
[[ -f "$ENV_FILE" ]] && pass "env file exists: $ENV_FILE" || issue "env file missing: $ENV_FILE"
docker network inspect media-net >/dev/null 2>&1 && pass "media-net exists" || issue "media-net network does not exist yet"
load_env_values
[[ -n "${HOST_PORT:-}" ]] && { ss -tulpn 2>/dev/null | grep -q ":${HOST_PORT}\b" && issue "HOST_PORT ${HOST_PORT} appears in use" || pass "HOST_PORT ${HOST_PORT} looks free"; }
[[ -n "${ROUTER_MODE:-}" ]] && pass "ROUTER_MODE detected: ${ROUTER_MODE}"
if [[ "${ROUTER_MODE,,}" == "osrm" ]]; then
  [[ -d "$OSRM_DATA_DIR" ]] && pass "OSRM_DATA_DIR exists: $OSRM_DATA_DIR" || issue "OSRM_DATA_DIR missing: $OSRM_DATA_DIR"
  [[ -f "$OSRM_DATA_DIR/$OSRM_PBF" ]] && pass "OSRM input PBF exists: $OSRM_PBF" || issue "OSRM input PBF missing: $OSRM_DATA_DIR/$OSRM_PBF"
  [[ -f "$OSRM_DATA_DIR/$OSRM_GRAPH" ]] && pass "OSRM graph exists: $OSRM_GRAPH" || issue "OSRM graph missing; run ./prepare-osrm.sh"
fi
if command -v curl >/dev/null 2>&1; then
  curl -fsS "http://127.0.0.1:${HOST_PORT:-9080}/api/health" >/dev/null 2>&1 && pass "web health endpoint is responding" || issue "web health endpoint is not responding on 127.0.0.1:${HOST_PORT:-9080}"
  if [[ "${ROUTER_MODE,,}" == "osrm" ]]; then
    curl -fsS "http://127.0.0.1:${OSRM_HOST_PORT:-5000}/nearest/v1/foot/144.9631,-37.8136" >/dev/null 2>&1 && pass "OSRM nearest endpoint is responding" || issue "OSRM endpoint is not responding on 127.0.0.1:${OSRM_HOST_PORT:-5000}"
  fi
else issue "curl is not installed"; fi
