#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  echo "Usage: ./scripts/version.sh check | set X.Y.Z" >&2
  exit 1
}

validate_semver() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
    echo "Version must use X.Y.Z format, for example 12.3.0." >&2
    exit 1
  }
}

check_version() {
  local version tag actual manifest failed=0
  tag="$(tr -d '[:space:]' < VERSION)"
  version="${tag#v}"
  validate_semver "$version"
  [[ "$tag" == "v$version" ]] || { echo "VERSION must include the v prefix." >&2; failed=1; }

  for manifest in package.json apps/*/package.json packages/*/package.json; do
    actual="$(node -p "require('./$manifest').version")"
    if [[ "$actual" != "$version" ]]; then
      echo "$manifest is $actual; expected $version" >&2
      failed=1
    fi
  done

  grep -q "ROGUEROUTE_VERSION=$version" .env.example || { echo ".env.example is not $version" >&2; failed=1; }
  grep -q "ROGUEROUTE_VERSION:-$version" compose.yaml || { echo "compose.yaml is not $version" >&2; failed=1; }
  grep -q "release-$version" README.md || { echo "README release badge is not $version" >&2; failed=1; }
  grep -q "v$version release notes" README.md || { echo "README release-note link is not $version" >&2; failed=1; }
  grep -q "## v$version" CHANGELOG.md || { echo "CHANGELOG is missing v$version" >&2; failed=1; }
  grep -q "Upload v$version" GITHUB-DESKTOP-UPLOAD.md || { echo "GitHub Desktop guide is not $version" >&2; failed=1; }
  grep -q "@version        $version" plugins/iitc/gpx-route-generator.user.js || { echo "IITC plugin is not $version" >&2; failed=1; }
  [[ -f "docs/RELEASE-v$version.md" ]] || { echo "Missing docs/RELEASE-v$version.md" >&2; failed=1; }

  (( failed == 0 )) || exit 1
  echo "All release surfaces match v$version."
}

set_version() {
  local new="$1" old old_minor new_minor release_new file
  local -a release_files
  validate_semver "$new"
  old="$(sed 's/^v//' VERSION | tr -d '[:space:]')"
  validate_semver "$old"
  [[ "$new" != "$old" ]] || { check_version; return; }
  old_minor="${old%.*}"
  new_minor="${new%.*}"
  release_new="docs/RELEASE-v${new}.md"
  release_files=(
    .env.example compose.yaml install.sh README.md GITHUB-DESKTOP-UPLOAD.md
    docs/INSTALL.md docs/UPGRADING.md docs/TROUBLESHOOTING.md
    apps/gpx-web/src/app/api/health/route.ts
    plugins/iitc/gpx-route-generator.user.js
    apps/gpx-web/public/iitc/rogueroute.user.js
    apps/gpx-web/public/downloads/iitc/rogueroute-exporter.user.js
  )
  for file in "${release_files[@]}"; do
    [[ -f "$file" ]] || continue
    sed -i "s/v${old}/v${new}/g; s/${old}/${new}/g; s/${old_minor}/${new_minor}/g" "$file"
  done

  if [[ ! -f "$release_new" ]]; then
    printf '# RogueRoute GPX v%s\n\nRelease notes for v%s.\n' "$new" "$new" > "$release_new"
  fi
  if ! grep -q "^## v${new}" CHANGELOG.md; then
    sed -i "1a\\\n## v${new} — Release preparation\\n\\n- Release surfaces synchronized to v${new}." CHANGELOG.md
  fi
  printf 'v%s\n' "$new" > VERSION

  for manifest in package.json apps/*/package.json packages/*/package.json; do
    node -e 'const fs=require("fs"); const p=process.argv[1]; const v=process.argv[2]; const j=JSON.parse(fs.readFileSync(p)); j.version=v; fs.writeFileSync(p, JSON.stringify(j,null,2)+"\n")' "$manifest" "$new"
  done

  check_version
  echo "Run pnpm install --lockfile-only before committing when workspace dependencies changed."
}

case "${1:-}" in
  check) check_version ;;
  set) [[ $# -eq 2 ]] || usage; set_version "$2" ;;
  *) usage ;;
esac
