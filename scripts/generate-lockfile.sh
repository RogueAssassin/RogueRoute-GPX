#!/usr/bin/env bash
set -euo pipefail

echo "Generating pnpm-lock.yaml using the official RogueRoute GPX v12 toolchain"
echo "Required standard: Node.js 24.18.0, Corepack 0.35.0, pnpm 11.12.0"

corepack enable
corepack prepare pnpm@11.12.0 --activate
pnpm install

echo "Done. Commit pnpm-lock.yaml to Git before creating the v9 release."
