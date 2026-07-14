#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
require_docker
ensure_env
if (( $# > 0 )); then
  compose logs --tail=200 -f "$@"
else
  compose logs --tail=200 -f
fi
