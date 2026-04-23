# Installation Overview

RogueRoute GPX now ships with two separate walkthroughs.

## Choose your path
- **Beginner / easiest path:** `docs/GUIDE-STANDARD-BEGINNER.md`
- **Intermediate / land-aware routing path:** `docs/GUIDE-VALHALLA-INTERMEDIATE.md`

## Shared first-run behavior
The first-run helper now supports mode-based environment selection.

On first run, it creates `infra/docker/.env` from one of these templates:
- `infra/docker/.env.standard`
- `infra/docker/.env.valhalla`

## Supported versions
- Node.js 24.15.0
- pnpm 10.33.1
- Docker Engine / CLI 29.4.1 with `docker compose`

For full requirement details, read `docs/SYSTEM-REQUIREMENTS.md`.
