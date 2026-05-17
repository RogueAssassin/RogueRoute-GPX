#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec ./infra/scripts/repair-osm-builds.sh "$@"
