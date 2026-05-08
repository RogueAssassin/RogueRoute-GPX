#!/usr/bin/env bash
set -euo pipefail
REPO="${ROGUEROUTE_REPO:-RogueAssassin/RogueRoute-GPX}"
CURRENT_VERSION="$(cat VERSION 2>/dev/null || grep -E '^ROGUEROUTE_VERSION=' infra/docker/.env 2>/dev/null | cut -d= -f2- || echo v0.0.0)"
API="https://api.github.com/repos/${REPO}/releases/latest"
AUTH_HEADER=()
[[ -n "${GITHUB_TOKEN:-}" ]] && AUTH_HEADER=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
LATEST_VERSION="$(curl -fsSL "${AUTH_HEADER[@]}" "$API" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | head -n1)"
echo "Current: ${CURRENT_VERSION}"
echo "Latest:  ${LATEST_VERSION}"
if [[ "$CURRENT_VERSION" != "$LATEST_VERSION" ]]; then
  echo "Update available. Run: sudo ./update.sh"
else
  echo "Already up to date."
fi
