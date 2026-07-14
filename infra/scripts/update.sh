#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
MODE="$(resolve_requested_mode "${1:-}")"
print_header "RogueRoute GPX v12 Update"
print_step 1 6 "Create env file if missing"
bootstrap_env_file "$MODE"
maybe_edit_env_file "$MODE"
print_step 2 6 "Update git checkout if available"
cd "$REPO_ROOT"
update_repo_if_git_checkout
# A pull may update the supported Node/pnpm pins and helper functions. Reload
# them before validating the host so upgrades do not continue with stale pins.
source "$SCRIPT_DIR/_common.sh"
print_step 3 6 "Check Docker and the updated Node.js requirement"
ensure_core_tools
ensure_node_version
ensure_env_file
validate_env_for_mode "$MODE"
print_step 4 6 "Prepare the updated pnpm requirement"
enable_pnpm
print_step 5 6 "Install dependencies"
pnpm install
repair_workspace_dependencies
print_step 6 6 "Build workspace"
build_workspace
log "Update complete. Run ./deploy.sh or ./deploy.sh osrm to restart services if needed."
