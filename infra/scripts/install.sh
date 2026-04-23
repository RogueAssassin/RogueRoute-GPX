#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
print_header "RogueRoute GPX v8 Build"
print_step 1 4 "Check Docker and Node.js"
ensure_core_tools
ensure_node_version
log "Repo root: $REPO_ROOT"
log "Docker directory: $DOCKER_DIR"
print_step 2 4 "Prepare pnpm"
enable_pnpm
cd "$REPO_ROOT"
print_step 3 4 "Install dependencies"
pnpm install
print_step 4 4 "Build workspace"
pnpm build
log "Install/build complete"
