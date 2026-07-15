#!/usr/bin/env bash
set -euo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET=/opt/rogueroute-gpx
DATA_DIR=/mnt/h/osrm
REGION=australia
START=false
OWNER="${SUDO_USER:-root}"
GROUP="$(id -gn "$OWNER")"

while (( $# )); do
  case "$1" in
    --path) TARGET="${2:?Missing value after --path}"; shift 2 ;;
    --data-dir) DATA_DIR="${2:?Missing value after --data-dir}"; shift 2 ;;
    --region) REGION="${2:?Missing value after --region}"; shift 2 ;;
    --start) START=true; shift ;;
    -h|--help)
      echo "Usage: sudo ./install.sh [--path DIR] [--data-dir DIR] [--region KEY] [--start]"
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "Run the installer with sudo." >&2; exit 1; }
case "$TARGET" in /|/opt|/opt/media-server) echo "Unsafe installation path: $TARGET" >&2; exit 1 ;; esac
[[ "$SOURCE" != "$TARGET" ]] || { echo "Run install.sh from a clone outside the target path." >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker Engine is required: https://docs.docker.com/engine/install/" >&2; exit 1; }
docker compose version >/dev/null || { echo "The Docker Compose plugin is required." >&2; exit 1; }

stamp="$(date +%Y%m%d-%H%M%S)"
backup="${TARGET}-backup-${stamp}"
old_env=""
if [[ -f "$TARGET/.env" ]]; then old_env="$TARGET/.env"; fi

if [[ -d "$TARGET" ]]; then
  (cd "$TARGET" && docker compose down) 2>/dev/null || true
  mv "$TARGET" "$backup"
  echo "Previous installation backed up to $backup"
  [[ -n "$old_env" ]] && old_env="$backup/.env"
fi

install -d -o "$OWNER" -g "$GROUP" -m 0755 "$TARGET" "$DATA_DIR"
install -o "$OWNER" -g "$GROUP" -m 0644 "$SOURCE/compose.yaml" "$TARGET/compose.yaml"
install -o "$OWNER" -g "$GROUP" -m 0644 "$SOURCE/.env.example" "$TARGET/.env.example"
install -o "$OWNER" -g "$GROUP" -m 0755 "$SOURCE/rogueroute" "$TARGET/rogueroute"
install -o "$OWNER" -g "$GROUP" -m 0644 "$SOURCE/README.md" "$TARGET/README.md"
install -d -o "$OWNER" -g "$GROUP" -m 0755 "$TARGET/scripts"
install -o "$OWNER" -g "$GROUP" -m 0755 "$SOURCE/scripts/osm.sh" "$TARGET/scripts/osm.sh"
install -o "$OWNER" -g "$GROUP" -m 0644 "$SOURCE/scripts/osm-region-catalog.sh" "$TARGET/scripts/osm-region-catalog.sh"
install -d -o "$OWNER" -g "$GROUP" -m 0755 "$TARGET/docs"
for guide in COMMANDS.md INSTALL.md OSM.md TROUBLESHOOTING.md UPGRADING.md; do
  install -o "$OWNER" -g "$GROUP" -m 0644 "$SOURCE/docs/$guide" "$TARGET/docs/$guide"
done

if [[ -n "$old_env" && -f "$old_env" ]]; then
  install -o "$OWNER" -g "$GROUP" -m 0600 "$old_env" "$TARGET/.env"
else
  install -o "$OWNER" -g "$GROUP" -m 0600 "$SOURCE/.env.example" "$TARGET/.env"
fi

set_env() {
  local key="$1" value="$2" file="$TARGET/.env"
  if grep -qE "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}
set_env ROGUEROUTE_VERSION 12.3.0
set_env OSRM_DATA_DIR "$DATA_DIR"
set_env OSRM_ACTIVE_REGION "$REGION"

catalog_line="$(bash -c 'source "$1"; region_from_catalog "$2"' _ "$TARGET/scripts/osm-region-catalog.sh" "$REGION")"
if [[ -n "$catalog_line" ]]; then
  IFS='|' read -r _ _ _ graph _ _ _ <<< "$catalog_line"
  set_env OSRM_GRAPH "${graph}-latest.osrm"
fi

if ! grep -qE '^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=.+$' "$TARGET/.env"; then
  command -v openssl >/dev/null || { echo "OpenSSL is required." >&2; exit 1; }
  set_env NEXT_SERVER_ACTIONS_ENCRYPTION_KEY "$(openssl rand -base64 32)"
fi
if ! grep -qE '^OSRM_MANAGER_TOKEN=.+$' "$TARGET/.env"; then
  command -v openssl >/dev/null || { echo "OpenSSL is required." >&2; exit 1; }
  set_env OSRM_MANAGER_TOKEN "$(openssl rand -hex 32)"
fi
if ! grep -qE '^OSRM_SWITCH_ACCESS_KEY=.+$' "$TARGET/.env"; then
  set_env OSRM_SWITCH_ACCESS_KEY "$(openssl rand -hex 16)"
fi
set_env OSRM_SWITCH_ENABLED true
set_env OSRM_MANAGER_URL http://manager:9090

echo "RogueRoute GPX v12.3.0 installed at $TARGET"
echo "OSRM data directory: $DATA_DIR"
echo "Website switch access key: $(grep -E '^OSRM_SWITCH_ACCESS_KEY=' "$TARGET/.env" | cut -d= -f2-)"
echo "Keep this key private; it authorizes region changes from the website."
if [[ "$START" == true ]]; then
  "$TARGET/rogueroute" start
else
  echo "Prepare a region, then start:"
  echo "  cd $TARGET"
  echo "  ./rogueroute osm download $REGION"
  echo "  ./rogueroute osm prepare $REGION"
  echo "  ./rogueroute start"
fi
