#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${1:-$(cd "$(dirname "$0")" && pwd)}"
RUN_USER="${SUDO_USER:-${USER:-$(id -un)}}"
RUN_GROUP="$(id -gn "$RUN_USER")"

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
fail() { echo "[ERROR] $*"; exit 1; }

[ -d "$REPO_DIR" ] || fail "Repository directory not found: $REPO_DIR"

info "Fixing permissions in: $REPO_DIR"
info "Using owner: $RUN_USER:$RUN_GROUP"

if command -v sudo >/dev/null 2>&1; then
  sudo chown -R "$RUN_USER:$RUN_GROUP" "$REPO_DIR"
else
  chown -R "$RUN_USER:$RUN_GROUP" "$REPO_DIR"
fi

find "$REPO_DIR" -type d -exec chmod 755 {} \;
find "$REPO_DIR" -type f -exec chmod 644 {} \;
find "$REPO_DIR" -type f -name "*.sh" -exec chmod 755 {} \;

for file in \
  install.sh deploy.sh update.sh status.sh logs.sh stop.sh \
  refresh.sh first-run.sh fix-permissions.sh prepare-osrm.sh verify-osrm.sh version-check.sh release.sh; do
  if [ -f "$REPO_DIR/$file" ]; then
    chmod 755 "$REPO_DIR/$file"
  fi
done

if command -v git >/dev/null 2>&1 && [ -d "$REPO_DIR/.git" ]; then
  git -C "$REPO_DIR" config core.filemode true || true
  for file in \
    install.sh deploy.sh update.sh status.sh logs.sh stop.sh \
    refresh.sh first-run.sh fix-permissions.sh prepare-osrm.sh verify-osrm.sh version-check.sh release.sh; do
    if [ -f "$REPO_DIR/$file" ]; then
      git -C "$REPO_DIR" update-index --chmod=+x "$file" 2>/dev/null || true
    fi
  done
fi

info "Permissions repaired."
info "Next: cd $REPO_DIR && ./first-run.sh"
