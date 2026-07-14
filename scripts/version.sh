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
    echo "Version must use X.Y.Z format, for example 12.2.0." >&2
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
  grep -q "@version        $version" plugins/iitc/gpx-route-generator.user.js || { echo "IITC plugin is not $version" >&2; failed=1; }
  [[ -f "docs/RELEASE-v$version.md" ]] || { echo "Missing docs/RELEASE-v$version.md" >&2; failed=1; }

  (( failed == 0 )) || exit 1
  echo "All release surfaces match v$version."
}

set_version() {
  local new="$1" old release_old release_new
  validate_semver "$new"
  old="$(sed 's/^v//' VERSION | tr -d '[:space:]')"
  validate_semver "$old"
  [[ "$new" != "$old" ]] || { check_version; return; }

  while IFS= read -r file; do
    sed -i "s/v${old}/v${new}/g; s/${old}/${new}/g" "$file"
  done < <(rg -l --fixed-strings "$old" \
    --glob '!pnpm-lock.yaml' --glob '!**/.next/**' --glob '!**/dist/**' \
    --glob '!node_modules/**')

  release_old="docs/RELEASE-v${old}.md"
  release_new="docs/RELEASE-v${new}.md"
  [[ ! -f "$release_old" || "$release_old" == "$release_new" ]] || mv "$release_old" "$release_new"
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
