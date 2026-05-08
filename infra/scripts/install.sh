#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
MODE="$(resolve_requested_mode "${1:-}")"
print_header "RogueRoute GPX v10 Build"
print_step 1 6 "Create env file if missing"
bootstrap_env_file "$MODE"
maybe_edit_env_file "$MODE"
print_step 2 6 "Check Docker and Node.js"
ensure_core_tools
ensure_node_version
ensure_env_file
validate_env_for_mode "$MODE"
log "Repo root: $REPO_ROOT"
log "Docker directory: $DOCKER_DIR"
print_step 3 6 "Prepare pnpm"
enable_pnpm
cd "$REPO_ROOT"
print_step 4 6 "Install dependencies"
pnpm install
print_step 5 6 "Build workspace"
pnpm build
print_step 6 6 "OSRM readiness summary"
if [[ "$MODE" == "osrm" ]]; then verify_osrm_outputs || true; else log "Direct mode selected; OSRM preparation skipped."; fi
log "Install/build complete"
