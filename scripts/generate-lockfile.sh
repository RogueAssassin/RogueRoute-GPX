#!/usr/bin/env bash
set -euo pipefail

echo "Generating pnpm-lock.yaml using the official RogueRoute GPX v8.0.0 toolchain"
echo "Required standard: Node.js 24.15.0, Corepack 0.34.7, pnpm 10.33.1"

corepack enable
corepack prepare pnpm@10.33.1 --activate
pnpm install

echo "Done. Commit pnpm-lock.yaml to Git before creating the v8.0.0 release."
