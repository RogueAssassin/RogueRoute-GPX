# Rev10.9 OSRM All-Downloaded Definite Fix

This revision keeps the OSRM-only system and makes `./prepare-osrm.sh all-downloaded` deterministic.

## Fixes

- Processes every `.osm.pbf` found recursively under `OSRM_DATA_DIR`.
- Does not fall back to `australia-latest.osm.pbf` inside the loop.
- Does not reload `.env` while processing each discovered file.
- Does not delete downloaded `.osm.pbf` inputs.
- Skips already completed graphs unless `--force` is provided.
- Moves matching old `.osrm*` outputs to `_osrm-backups/` when `--force` is used.
- Updates pnpm references to `10.33.4`.

## Recommended command

```bash
./prepare-osrm.sh all-downloaded
```

Force rebuild only when required:

```bash
./prepare-osrm.sh all-downloaded --force --yes
```
