#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
enable_pnpm
cd "$REPO_ROOT"
log "Pulling latest changes"
git pull
log "Installing dependencies"
pnpm install
log "Building workspace"
pnpm build
log "Update complete. Run ./deploy.sh or ./deploy-valhalla.sh to restart services if needed."
