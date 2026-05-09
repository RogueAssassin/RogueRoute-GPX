#!/usr/bin/env bash
set -euo pipefail

echo "Generating pnpm-lock.yaml using the official RogueRoute GPX v10 toolchain"
echo "Required standard: Node.js 24.15.0, Corepack 0.34.7, pnpm 11.0.8"

corepack enable
corepack prepare pnpm@11.0.8 --activate
pnpm install

echo "Done. Commit pnpm-lock.yaml to Git before creating the v9 release."
