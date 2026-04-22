#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_EXAMPLE="$SCRIPT_DIR/infra/docker/.env.example"
ENV_FILE="$SCRIPT_DIR/infra/docker/.env"

if [ ! -x "$SCRIPT_DIR/install.sh" ] || [ ! -x "$SCRIPT_DIR/deploy.sh" ]; then
  bash "$SCRIPT_DIR/fix-permissions.sh" "$SCRIPT_DIR"
fi

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "[INFO] Created $ENV_FILE from template. Review it before production use."
fi

echo "[INFO] Starting first-run setup"
bash "$SCRIPT_DIR/install.sh"
echo "[INFO] Base app build complete"
echo "[INFO] Use ./deploy.sh for the web app only, or ./deploy-valhalla.sh if you have filled VALHALLA_DATA_PATH and added map data."
echo "[INFO] If Valhalla ever gets stuck loading broken tiles, run ./repair-valhalla.sh and then ./deploy-valhalla.sh"
