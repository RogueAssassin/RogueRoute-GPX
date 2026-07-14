#!/usr/bin/env bash
set -euo pipefail
VERSION="${1:-}"
[[ -n "$VERSION" ]] || { echo "Usage: ./release.sh v12"; exit 1; }
[[ "$VERSION" =~ ^v[0-9]+([.][0-9]+){0,2}$ ]] || { echo "Version must look like v12 or v12.1.0" >&2; exit 1; }
git diff --quiet && git diff --cached --quiet || { echo "Commit the release files before tagging." >&2; exit 1; }
BRANCH="$(git branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "Cannot release from a detached HEAD." >&2; exit 1; }
if [[ "$(tr -d '[:space:]' < VERSION 2>/dev/null || true)" != "$VERSION" ]]; then
  echo "$VERSION" > VERSION
  git add VERSION
  git commit -m "Release ${VERSION}"
fi
git tag -a "$VERSION" -m "RogueRoute-GPX ${VERSION}"
git push origin "$BRANCH"
git push origin "$VERSION"
echo "[OK] Pushed release tag ${VERSION}"
echo "Create the GitHub Release from tag ${VERSION}."
