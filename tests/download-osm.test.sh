#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_ROOT="$(mktemp -d)"
trap 'rm -rf "$TEST_ROOT"' EXIT

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/data"

cat > "$TEST_ROOT/bin/osmium" <<'FAKE_OSMIUM'
#!/usr/bin/env bash
set -euo pipefail
[[ " $* " == *" fileinfo "* ]]
[[ " $* " == *" -F pbf "* ]]
[[ " $* " == *" -e "* ]]
FAKE_OSMIUM

cat > "$TEST_ROOT/bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
echo "curl must not be called when a valid preserved PBF exists" >&2
exit 99
FAKE_CURL

chmod +x "$TEST_ROOT/bin/osmium" "$TEST_ROOT/bin/curl"
export PATH="$TEST_ROOT/bin:$PATH"
export OSRM_DATA_DIR="$TEST_ROOT/data"
export OSM_VERIFY_FULL=true
export ROGUEROUTE_OSM_DOWNLOAD_LIBRARY_ONLY=true

# shellcheck source=../infra/scripts/download-osm.sh
source "$REPO_ROOT/infra/scripts/download-osm.sh"

pbf="new-zealand-latest.osm.pbf"
part="$OSRM_DATA_DIR/${pbf}.part"
preserved="${part}.invalid-20260713-184852"
printf '\0\0\0\x10OSMHeader-test-payload' > "$preserved"

validate_pbf "$preserved"
[[ "$(pbf_status "$pbf")" == "recoverable" ]]
download_file "https://example.invalid/$pbf" "$pbf"
[[ -f "$OSRM_DATA_DIR/$pbf" ]]
[[ ! -f "$preserved" ]]

echo "download-osm validation/recovery tests passed"
