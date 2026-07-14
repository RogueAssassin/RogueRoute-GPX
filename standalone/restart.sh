#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_common.sh"
require_docker
ensure_env
verify_graph
compose pull
compose up -d --force-recreate --remove-orphans
compose ps
