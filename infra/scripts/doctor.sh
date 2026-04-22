#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"

pass() { echo "[PASS] $*"; }
issue() { echo "[WARN] $*"; }

if command -v docker >/dev/null 2>&1; then pass "docker is installed"; else issue "docker is not installed"; fi
if docker info >/dev/null 2>&1; then pass "docker daemon is running"; else issue "docker daemon is not responding"; fi
if docker compose version >/dev/null 2>&1; then pass "docker compose is available"; else issue "docker compose is not available"; fi
if command -v node >/dev/null 2>&1; then
  node_version="$(node -v 2>/dev/null || true)"
  if [[ "${node_version#v}" == 22.* ]]; then pass "Node.js $node_version detected"; else issue "Node.js 22 is recommended. Detected: ${node_version:-unknown}"; fi
else
  issue "Node.js is not installed"
fi
if command -v corepack >/dev/null 2>&1; then pass "corepack is available"; else issue "corepack is missing"; fi
if command -v pnpm >/dev/null 2>&1; then pass "pnpm is available ($(pnpm -v 2>/dev/null || echo unknown))"; else issue "pnpm is not installed or not activated yet"; fi
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
