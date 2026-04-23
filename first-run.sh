#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/infra/docker/.env"
ENV_STANDARD="$SCRIPT_DIR/infra/docker/.env.standard"
ENV_VALHALLA="$SCRIPT_DIR/infra/docker/.env.valhalla"

if [ ! -x "$SCRIPT_DIR/install.sh" ] || [ ! -x "$SCRIPT_DIR/deploy.sh" ]; then
  bash "$SCRIPT_DIR/fix-permissions.sh" "$SCRIPT_DIR"
fi

choose_mode() {
  if [[ -n "${ROGUEROUTE_MODE:-}" ]]; then
    case "${ROGUEROUTE_MODE,,}" in
      standard) echo "standard"; return 0 ;;
      valhalla) echo "valhalla"; return 0 ;;
      *) echo "[ERROR] Invalid ROGUEROUTE_MODE: $ROGUEROUTE_MODE" >&2; exit 1 ;;
    esac
  fi

  if [[ -t 0 ]]; then
    echo
    echo "Choose your setup mode:"
    echo "  1) Standard  - easiest setup, lower resource usage"
    echo "  2) Valhalla  - land-aware routing, higher resource usage"
    read -r -p "Enter 1 or 2 [1]: " choice
    case "${choice:-1}" in
      1) echo "standard" ;;
      2) echo "valhalla" ;;
      *) echo "standard" ;;
    esac
  else
    echo "standard"
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  MODE="$(choose_mode)"
  case "$MODE" in
    standard)
      cp "$ENV_STANDARD" "$ENV_FILE"
      echo "[INFO] Created infra/docker/.env from .env.standard"
      ;;
    valhalla)
      cp "$ENV_VALHALLA" "$ENV_FILE"
      echo "[INFO] Created infra/docker/.env from .env.valhalla"
      echo "[INFO] Before deployment, update VALHALLA_DATA_PATH to your real map-data folder."
      ;;
  esac
else
  echo "[INFO] Reusing existing infra/docker/.env"
fi

echo "[INFO] Starting RogueRoute GPX v8.0.0 first-run setup"
echo "[INFO] Supported runtime for local install/build tasks: Node.js 24.15.0"
echo "[INFO] Supported package manager: pnpm 10.33.1 via Corepack"
bash "$SCRIPT_DIR/install.sh"
echo "[INFO] Base app build complete"
echo "[INFO] Standard mode: ./deploy.sh"
echo "[INFO] Valhalla mode: edit infra/docker/.env, set VALHALLA_DATA_PATH, place .osm.pbf files or tiles there, then run ./deploy-valhalla.sh"
echo "[INFO] After a reboot or crash, use ./restart.sh or ./restart-valhalla.sh"
