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

echo "[INFO] Starting RogueRoute GPX v7.6.0 first-run setup"
echo "[INFO] Node.js 22 is the supported runtime for local install/build steps."
echo "[INFO] If Corepack is available, RogueRoute GPX will activate pnpm automatically on first run."
bash "$SCRIPT_DIR/install.sh"
echo "[INFO] Base app build complete"
echo "[INFO] Standard mode: use ./deploy.sh for the base web app on port 9080."
echo "[INFO] Valhalla Enhanced: set VALHALLA_DATA_PATH in infra/docker/.env, place your .osm.pbf files or built tiles there, then run ./deploy-valhalla.sh."
echo "[INFO] After a reboot or crash, use ./restart.sh or ./restart-valhalla.sh instead of the deploy scripts."
echo "[INFO] If Valhalla behaves oddly after a crash, run ./verify-valhalla.sh first."
