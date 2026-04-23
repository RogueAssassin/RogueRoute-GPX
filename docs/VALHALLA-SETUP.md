# Valhalla Setup Overview

For the full guided walkthrough, use:

- `docs/GUIDE-VALHALLA-INTERMEDIATE.md`

## Quick summary
Valhalla mode requires:
- `infra/docker/.env` created from `infra/docker/.env.valhalla`
- a valid `VALHALLA_DATA_PATH`
- one or more `.osm.pbf` files, or existing Valhalla tiles
- port `8002` available

## Recommended practice
Store map data outside the application folder so app updates do not remove your routing data.
