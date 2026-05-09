#!/usr/bin/env bash
set -euo pipefail
REPO_URL="${1:-}"
TARGET_DIR="${2:-RogueRoute-GPX}"
if [[ -z "$REPO_URL" ]]; then
  echo "Usage: ./runtime-clone.sh <git-repo-url> [target-dir]"
  echo "Example: ./runtime-clone.sh https://github.com/YOURNAME/RogueRoute-GPX.git /opt/media-server/RogueRoute-GPX"
  exit 1
fi
if [[ -e "$TARGET_DIR/.git" ]]; then
  echo "Git checkout already exists: $TARGET_DIR"
  exit 1
fi
git clone --filter=blob:none --no-checkout "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"
git sparse-checkout init --cone
git sparse-checkout set \
  apps packages plugins infra scripts \
  package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json \
  .npmrc .nvmrc .node-version .dockerignore .gitignore VERSION \
  first-run.sh install.sh deploy.sh update.sh restart.sh refresh.sh status.sh stop.sh logs.sh doctor.sh \
  download-osm.sh prepare-osrm.sh prepare-osm.sh switch-osrm-region.sh verify-osrm.sh fix-permissions.sh clean-web.sh version-check.sh setup-env.sh release.sh
git checkout
bash ./fix-permissions.sh
printf '\nRuntime-only checkout ready. Next: ./setup-env.sh osrm && ./first-run.sh osrm\n'
