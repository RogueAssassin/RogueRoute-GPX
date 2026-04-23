#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
print_header "RogueRoute GPX v8.0.0 Update"
print_step 1 5 "Check Docker and Node.js"
ensure_core_tools
ensure_node_version
print_step 2 5 "Prepare pnpm"
enable_pnpm
print_step 3 5 "Update git checkout if available"
cd "$REPO_ROOT"
update_repo_if_git_checkout
print_step 4 5 "Install dependencies"
pnpm install
print_step 5 5 "Build workspace"
pnpm build
log "Update complete. Run ./deploy.sh or ./deploy-valhalla.sh to restart services if needed."
