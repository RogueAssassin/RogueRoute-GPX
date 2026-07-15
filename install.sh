#!/usr/bin/env bash
set -euo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SOURCE"
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
      echo "Usage: sudo ./install.sh [--path GIT_CHECKOUT] [--data-dir DIR] [--region KEY] [--start]"
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "Run the installer with sudo." >&2; exit 1; }
case "$TARGET" in /|/opt|/opt/media-server) echo "Unsafe installation path: $TARGET" >&2; exit 1 ;; esac
command -v docker >/dev/null || { echo "Docker Engine is required: https://docs.docker.com/engine/install/" >&2; exit 1; }
docker compose version >/dev/null || { echo "The Docker Compose plugin is required." >&2; exit 1; }
command -v git >/dev/null || { echo "Git is required for repository-managed updates." >&2; exit 1; }
[[ -d "$TARGET/.git" ]] || {
  echo "$TARGET is not a Git checkout." >&2
  echo "Clone https://github.com/RogueAssassin/RogueRoute-GPX.git into the installation path first." >&2
  exit 1
}
[[ "$(cd "$TARGET" && pwd)" == "$SOURCE" ]] || {
  echo "Run install.sh from inside the target Git checkout; copying release files is no longer supported." >&2
  exit 1
}

install -d -o "$OWNER" -g "$GROUP" -m 0755 "$DATA_DIR"
chown -R "$OWNER:$GROUP" "$TARGET"
chmod +x "$TARGET/install.sh" "$TARGET/rogueroute" "$TARGET/scripts/osm.sh"

if [[ ! -f "$TARGET/.env" ]]; then
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
VERSION="$(sed 's/^v//' "$TARGET/VERSION" | tr -d '[:space:]')"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid VERSION file." >&2; exit 1; }
set_env ROGUEROUTE_VERSION "$VERSION"
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
set_env OSRM_SWITCH_ENABLED true
set_env OSRM_MANAGER_URL http://manager:9090
set_env OSRM_MANAGER_TOKEN_FILE /run/rogueroute-secrets/manager-token
set_env OSRM_SWITCH_COOLDOWN_SECONDS 60
sed -i '/^OSRM_MANAGER_TOKEN=/d; /^OSRM_SWITCH_ACCESS_KEY=/d' "$TARGET/.env"

echo "RogueRoute GPX v$VERSION configured at $TARGET"
echo "OSRM data directory: $DATA_DIR"
if [[ "$START" == true ]]; then
  "$TARGET/rogueroute" start
else
  echo "Prepare a region, then start:"
  echo "  cd $TARGET"
  echo "  ./rogueroute osm download $REGION"
  echo "  ./rogueroute osm prepare $REGION"
  echo "  ./rogueroute start"
fi
