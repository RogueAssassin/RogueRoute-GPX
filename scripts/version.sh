#!/usr/bin/env bash
# Keep every release surface on one version. Needs only bash, grep and sed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MANIFESTS=(package.json apps/*/package.json packages/*/package.json)
PLUGIN=apps/gpx-web/public/downloads/iitc/rogueroute-gpx.user.js
LEGACY_PLUGIN=apps/gpx-web/public/downloads/iitc/rogueroute-exporter.user.js

usage() {
  echo "Usage: ./scripts/version.sh check | set X.Y.Z" >&2
  exit 1
}

validate_semver() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version must use X.Y.Z format, for example 13.0.0." >&2; exit 1; }
}

manifest_version() {
  sed -nE '0,/^  "version": "([^"]+)",?$/s//\1/p' "$1"
}

check_version() {
  local version tag manifest failed=0
  tag="$(tr -d '[:space:]' < VERSION)"
  version="${tag#v}"
  validate_semver "$version"
  [[ "$tag" == "v$version" ]] || { echo "VERSION must include the v prefix." >&2; failed=1; }

  for manifest in "${MANIFESTS[@]}"; do
    [[ "$(manifest_version "$manifest")" == "$version" ]] || { echo "$manifest is not $version" >&2; failed=1; }
  done
  grep -q "^ROGUEROUTE_VERSION=$version$" .env.example || { echo ".env.example is not $version" >&2; failed=1; }
  grep -q "ROGUEROUTE_TAG:-$version}" compose.yaml || { echo "compose.yaml image tag is not $version" >&2; failed=1; }
  grep -q "release-$version-" README.md || { echo "README release badge is not $version" >&2; failed=1; }
  grep -q "^## v$version" CHANGELOG.md || { echo "CHANGELOG is missing v$version" >&2; failed=1; }
  grep -q "@version        $version$" "$PLUGIN" || { echo "IITC plugin is not $version" >&2; failed=1; }
  cmp -s "$PLUGIN" "$LEGACY_PLUGIN" || { echo "$LEGACY_PLUGIN must stay identical to $PLUGIN" >&2; failed=1; }
  [[ -f "docs/releases/v$version.md" ]] || { echo "Missing docs/releases/v$version.md" >&2; failed=1; }

  (( failed == 0 )) || exit 1
  echo "All release surfaces match v$version."
}

set_version() {
  local new="$1" old manifest
  validate_semver "$new"
  old="$(sed 's/^v//' VERSION | tr -d '[:space:]')"
  validate_semver "$old"
  printf 'v%s\n' "$new" > VERSION
  for manifest in "${MANIFESTS[@]}"; do
    sed -i -E "0,/^  \"version\": \"[^\"]+\"/s//  \"version\": \"$new\"/" "$manifest"
  done
  sed -i -E "s/^ROGUEROUTE_(VERSION|TAG)=.*/ROGUEROUTE_\1=$new/" .env.example
  sed -i -E "s/(ROGUEROUTE_(TAG|VERSION):-)[0-9]+\.[0-9]+\.[0-9]+/\1$new/g" compose.yaml
  sed -i -E "s/release-[0-9]+\.[0-9]+\.[0-9]+-/release-$new-/; s/Version \*\*[0-9]+\.[0-9]+\.[0-9]+\*\*/Version **$new**/; s#docs/releases/v[0-9]+\.[0-9]+\.[0-9]+\.md#docs/releases/v$new.md#g; s/v[0-9]+\.[0-9]+\.[0-9]+ release notes/v$new release notes/" README.md
  sed -i -E "s/^(\/\/ @version +)[0-9]+\.[0-9]+\.[0-9]+$/\1$new/; s/RogueRoute GPX v[0-9]+\.[0-9]+\.[0-9]+/RogueRoute GPX v$new/; s/pluginVersion: \"[0-9]+\.[0-9]+\.[0-9]+\"/pluginVersion: \"$new\"/" "$PLUGIN"
  cp "$PLUGIN" "$LEGACY_PLUGIN"
  [[ -f "docs/releases/v$new.md" ]] || printf '# rogueroute-gpx v%s\n\nRelease notes for v%s.\n' "$new" "$new" > "docs/releases/v$new.md"
  grep -q "^## v$new" CHANGELOG.md || sed -i "1a\\\n## v$new\\n\\n- Release surfaces synchronized to v$new." CHANGELOG.md
  echo "Updated $old -> $new."
  check_version
}

case "${1:-}" in
  check) check_version ;;
  set) [[ $# -eq 2 ]] || usage; set_version "$2" ;;
  *) usage ;;
esac
