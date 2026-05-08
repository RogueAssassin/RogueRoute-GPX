#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
ensure_core_tools
clean_web_build_artifacts true
clean_stale_docker_builders
log "Web cleanup complete"
