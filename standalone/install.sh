#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="/opt/media-server/RogueRoute-GPX"
YES=false
START=true

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target) TARGET="${2:-}"; shift 2 ;;
    --yes|-y) YES=true; shift ;;
    --no-start) START=false; shift ;;
    -h|--help)
      echo "Usage: sudo ./install.sh [--target /opt/media-server/RogueRoute-GPX] [--yes] [--no-start]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

case "$TARGET" in
  /|/opt|/opt/media-server) echo "Refusing unsafe target: $TARGET" >&2; exit 1 ;;
esac
[[ "$SOURCE_DIR" != "$TARGET" ]] || { echo "Extract the standalone ZIP outside the target directory before running install.sh." >&2; exit 1; }

if [[ "$EUID" -ne 0 && "$TARGET" == /opt/* ]]; then
  echo "Run this installer with sudo when targeting /opt." >&2
  exit 1
fi

if [[ "$YES" != "true" ]]; then
  echo "This replaces the active RogueRoute application files at: $TARGET"
  echo "Existing files are moved to a timestamped backup; OSRM data outside the target is untouched."
  read -r -p "Continue? [y/N]: " reply
  case "${reply,,}" in y|yes) ;; *) echo "Cancelled."; exit 0 ;; esac
fi

stamp="$(date +%Y%m%d-%H%M%S)"
backup="$(dirname "$TARGET")/RogueRoute-GPX-backup-$stamp"
old_env=""
old_env_relative=""

if [[ -f "$TARGET/infra/docker/.env" ]]; then
  old_env="$TARGET/infra/docker/.env"
elif [[ -f "$TARGET/.env" ]]; then
  old_env="$TARGET/.env"
fi

if [[ -n "$old_env" ]]; then
  old_env_relative="${old_env#"$TARGET"/}"
  old_data_dir="$(grep -E '^OSRM_DATA_DIR=' "$old_env" | tail -n1 | cut -d= -f2- || true)"
  case "$old_data_dir" in
    "$TARGET"/*)
      echo "OSRM_DATA_DIR is inside the application directory: $old_data_dir" >&2
      echo "Move it outside $TARGET before running this migration so map data cannot be displaced." >&2
      exit 1
      ;;
  esac
fi

if [[ -d "$TARGET" ]]; then
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    if [[ -f "$TARGET/infra/docker/docker-compose.yml" ]]; then
      (cd "$TARGET/infra/docker" && docker compose -f docker-compose.yml -f docker-compose.osrm.yml down) || true
    elif [[ -f "$TARGET/docker-compose.yml" ]]; then
      (cd "$TARGET" && docker compose down) || true
    fi
  fi
  mv "$TARGET" "$backup"
  echo "[INFO] Previous application moved to: $backup"
  if [[ -n "$old_env" ]]; then
    old_env="$backup/$old_env_relative"
  fi
fi

mkdir -p "$TARGET"
cp -a "$SOURCE_DIR/." "$TARGET/"
if [[ -n "$old_env" && -f "$old_env" ]]; then
  cp "$old_env" "$TARGET/.env"
else
  cp "$TARGET/.env.example" "$TARGET/.env"
fi

set_value() {
  local key="$1" value="$2"
  if grep -qE "^${key}=" "$TARGET/.env"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$TARGET/.env"
  else
    printf '%s=%s\n' "$key" "$value" >> "$TARGET/.env"
  fi
}

set_value ROGUEROUTE_IMAGE ghcr.io/rogueassassin/rogueroute-gpx
set_value ROGUEROUTE_IMAGE_TAG v12
set_value NEXT_PUBLIC_APP_VERSION v12
set_value OSRM_SNAP_MAX_RADIUS_METERS 5000
set_value OSRM_SWITCH_ENABLED false

chmod +x "$TARGET"/*.sh
chmod 600 "$TARGET/.env" 2>/dev/null || true
echo "[INFO] Standalone v12 Docker files installed at: $TARGET"
echo "[INFO] Existing OSRM data was not copied or deleted."

if [[ "$START" == "true" ]]; then
  "$TARGET/start.sh"
else
  echo "[INFO] Start later with: cd $TARGET && ./start.sh"
fi
