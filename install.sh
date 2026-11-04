#!/usr/bin/env bash
# rogueroute-gpx installer: configures .env in this Git checkout and optionally starts the
# container and builds the first map region. Only Docker or Podman (with Compose) is needed.
set -euo pipefail

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$SOURCE"
DATA_DIR=/mnt/h/osrm
REGION=australia
START=false
OWNER="${SUDO_USER:-$(id -un)}"
GROUP="$(id -gn "$OWNER")"

while (( $# )); do
  case "$1" in
    --path) TARGET="${2:?Missing value after --path}"; shift 2 ;;
    --data-dir) DATA_DIR="${2:?Missing value after --data-dir}"; shift 2 ;;
    --region) REGION="${2:?Missing value after --region}"; shift 2 ;;
    --start) START=true; shift ;;
    -h|--help)
      echo "Usage: ./install.sh [--data-dir DIR] [--region KEY] [--start]"
      echo "  --start   start the container, then download and prepare --region if needed"
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

case "$TARGET" in /|/opt|/opt/media-server) echo "Unsafe installation path: $TARGET" >&2; exit 1 ;; esac
[[ "$REGION" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "Invalid region key: $REGION" >&2; exit 1; }
grep -q "\"key\": \"$REGION\"" "$SOURCE/regions.json" || { echo "Unknown region: $REGION (see regions.json)" >&2; exit 1; }
command -v git >/dev/null || { echo "Git is required for repository-managed updates." >&2; exit 1; }
[[ -d "$TARGET/.git" ]] || {
  echo "$TARGET is not a Git checkout." >&2
  echo "Clone https://github.com/RogueAssassin/rogueroute-gpx.git into the installation path first." >&2
  exit 1
}
[[ "$(cd "$TARGET" && pwd)" == "$SOURCE" ]] || {
  echo "Run install.sh from inside the target Git checkout." >&2
  exit 1
}

RUNTIME="${ROGUEROUTE_RUNTIME:-auto}"
if [[ "$RUNTIME" == auto ]]; then
  candidates=(podman docker); [[ $EUID -eq 0 ]] && candidates=(docker podman)
  for engine in "${candidates[@]}"; do
    if command -v "$engine" >/dev/null && "$engine" info >/dev/null 2>&1 && "$engine" compose version >/dev/null 2>&1; then
      RUNTIME="$engine"; break
    fi
  done
  [[ "$RUNTIME" != auto ]] || { echo "A running Docker or Podman engine with its Compose provider is required." >&2; exit 1; }
fi
[[ "$RUNTIME" == docker || "$RUNTIME" == podman ]] || { echo "ROGUEROUTE_RUNTIME must be auto, docker, or podman." >&2; exit 1; }
if [[ "$RUNTIME" == podman && $EUID -eq 0 && -n "${SUDO_USER:-}" ]]; then
  echo "For rootless Podman, run ./install.sh without sudo." >&2
  exit 1
fi

if [[ $EUID -eq 0 ]]; then
  install -d -o "$OWNER" -g "$GROUP" -m 0755 "$DATA_DIR"
  chown -R "$OWNER:$GROUP" "$TARGET"
else
  install -d -m 0755 "$DATA_DIR"
  [[ -w "$TARGET" ]] || { echo "$TARGET is not writable by $(id -un)." >&2; exit 1; }
fi
chmod +x "$TARGET/install.sh" "$TARGET/rogueroute-gpx" "$TARGET/rogueroute"
[[ -f "$TARGET/.env" ]] || install -m 0600 "$SOURCE/.env.example" "$TARGET/.env"
[[ $EUID -eq 0 ]] && chown "$OWNER:$GROUP" "$TARGET/.env"

set_env() {
  local file="$TARGET/.env"
  if grep -qE "^${1}=" "$file"; then sed -i "s|^${1}=.*|${1}=${2}|" "$file"; else printf '%s=%s\n' "$1" "$2" >> "$file"; fi
}

VERSION="$(sed 's/^v//' "$TARGET/VERSION" | tr -d '[:space:]')"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Invalid VERSION file." >&2; exit 1; }
set_env ROGUEROUTE_VERSION "$VERSION"
CHANNEL="$(grep -E "^ROGUEROUTE_CHANNEL=" "$TARGET/.env" | tail -n1 | cut -d= -f2- || true)"
if [[ "${CHANNEL:-stable}" == testing ]]; then set_env ROGUEROUTE_TAG "$VERSION-testing"; else set_env ROGUEROUTE_TAG "$VERSION"; fi
set_env ROGUEROUTE_RUNTIME "$RUNTIME"
set_env PUID "$(id -u "$OWNER")"
set_env PGID "$(id -g "$OWNER")"
set_env OSRM_DATA_DIR "$DATA_DIR"
set_env OSRM_ACTIVE_REGION "$REGION"

echo "rogueroute-gpx v$VERSION configured at $TARGET ($RUNTIME)"
echo "Map data directory: $DATA_DIR"
run() { "$@"; }
if [[ "$START" == true ]]; then
  run "$TARGET/rogueroute-gpx" start
  if ! run "$TARGET/rogueroute-gpx" osm verify "$REGION" >/dev/null 2>&1; then
    run "$TARGET/rogueroute-gpx" osm download "$REGION"
    run "$TARGET/rogueroute-gpx" osm prepare "$REGION"
  fi
  run "$TARGET/rogueroute-gpx" osm status
else
  echo "Next steps:"
  echo "  cd $TARGET"
  echo "  ./rogueroute-gpx start"
  echo "  ./rogueroute-gpx osm download $REGION"
  echo "  ./rogueroute-gpx osm prepare $REGION"
fi
