#!/usr/bin/env bash
set -e

git pull

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@10.12.1 --activate
elif ! command -v pnpm >/dev/null 2>&1; then
  echo "Error: neither corepack nor pnpm is available."
  echo "Install pnpm with: sudo npm install -g pnpm@10.12.1"
  exit 1
fi

pnpm install
pnpm build
docker compose \
  -f infra/docker/docker-compose.yml \
  -f infra/docker/docker-compose.valhalla.yml \
  up -d --build
