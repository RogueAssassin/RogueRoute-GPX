#!/usr/bin/env bash
set -euo pipefail
VERSION="${1:-}"
[[ -n "$VERSION" ]] || { echo "Usage: ./release.sh v10.0.0"; exit 1; }
echo "$VERSION" > VERSION
git add .
git commit -m "Release ${VERSION}" || true
git tag -a "$VERSION" -m "RogueRoute-GPX ${VERSION}"
git push origin main
git push origin "$VERSION"
echo "[OK] Pushed release tag ${VERSION}"
echo "Create the GitHub Release from tag ${VERSION}."
