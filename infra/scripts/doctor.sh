#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

pass() { echo "[PASS] $*"; }
issue() { echo "[WARN] $*"; }

if command -v docker >/dev/null 2>&1; then pass "docker is installed"; else issue "docker is not installed"; fi
if docker info >/dev/null 2>&1; then pass "docker daemon is running"; else issue "docker daemon is not responding"; fi
if docker compose version >/dev/null 2>&1; then pass "docker compose is available"; else issue "docker compose is not available"; fi
if command -v docker >/dev/null 2>&1; then
  docker_version="$(docker --version 2>/dev/null | sed -E 's/.* version ([0-9.]+).*/\1/' || true)"
  if [[ "$docker_version" == "$EXPECTED_DOCKER_VERSION" ]]; then pass "Docker $docker_version matches the supported standard"; else issue "Docker $EXPECTED_DOCKER_VERSION is the supported standard. Detected: ${docker_version:-unknown}"; fi
fi
if command -v node >/dev/null 2>&1; then
  node_version="$(node -v 2>/dev/null || true)"
  if [[ "$node_version" == "v$EXPECTED_NODE_VERSION" ]]; then pass "Node.js $node_version matches the supported standard"; elif [[ "${node_version#v}" == ${EXPECTED_NODE_MAJOR}.* ]]; then issue "Node.js $EXPECTED_NODE_VERSION is the supported standard. Detected: ${node_version:-unknown}"; else issue "Node.js $EXPECTED_NODE_VERSION is required. Detected: ${node_version:-unknown}"; fi
else
  issue "Node.js is not installed"
fi
if command -v corepack >/dev/null 2>&1; then
  corepack_version="$(corepack --version 2>/dev/null || true)"
  if [[ "$corepack_version" == "$EXPECTED_COREPACK_VERSION" ]]; then pass "Corepack $corepack_version matches the supported standard"; else issue "Corepack $EXPECTED_COREPACK_VERSION is the supported standard. Detected: ${corepack_version:-unknown}"; fi
else
  issue "corepack is missing"
fi
if command -v pnpm >/dev/null 2>&1; then
  pnpm_version="$(pnpm -v 2>/dev/null || echo unknown)"
  if [[ "$pnpm_version" == "$EXPECTED_PNPM_VERSION" ]]; then pass "pnpm $pnpm_version matches the supported standard"; else issue "pnpm $EXPECTED_PNPM_VERSION is the supported standard. Detected: ${pnpm_version:-unknown}"; fi
else
  issue "pnpm is not installed or not activated yet"
fi
if [[ -f "$ENV_FILE" ]]; then pass "env file exists: $ENV_FILE"; else issue "env file missing: $ENV_FILE"; fi
if docker network inspect media-net >/dev/null 2>&1; then pass "media-net exists"; else issue "media-net network does not exist yet"; fi
load_env_values
if [[ -n "${HOST_PORT:-}" ]]; then
  if ss -tulpn 2>/dev/null | grep -q ":${HOST_PORT}\b"; then issue "HOST_PORT ${HOST_PORT} appears in use"; else pass "HOST_PORT ${HOST_PORT} looks free"; fi
fi
if [[ -n "${VALHALLA_DATA_PATH:-}" ]]; then
  if [[ -d "$VALHALLA_DATA_PATH" ]]; then pass "VALHALLA_DATA_PATH exists: $VALHALLA_DATA_PATH"; else issue "VALHALLA_DATA_PATH is missing: $VALHALLA_DATA_PATH"; fi
fi
if command -v curl >/dev/null 2>&1; then
  if curl -fsS http://127.0.0.1:9080/api/health >/dev/null 2>&1; then pass "web health endpoint is responding"; else issue "web health endpoint is not responding on 127.0.0.1:9080"; fi
  if curl -fsS http://127.0.0.1:8002/status >/dev/null 2>&1; then pass "Valhalla status endpoint is responding"; else issue "Valhalla status endpoint is not responding on 127.0.0.1:8002"; fi
else
  issue "curl is not installed"
fi
