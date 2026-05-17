#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
print_header "RogueRoute GPX Dependency Repair"
ensure_node_version
enable_pnpm
repair_workspace_dependencies
log "Dependency repair complete. You can now rerun ./first-run.sh or ./install.sh."
