# Rev10.7 OSRM all-downloaded selection fix

Fixes a bug where `./prepare-osrm.sh all-downloaded` discovered multiple `.osm.pbf` files but kept processing only the active/default env graph, usually `australia-latest.osm.pbf`.

## Root cause

`build_selected()` called `check_osrm_data()`, and that helper reloads `infra/docker/.env`. During an `all-downloaded` loop this reset the in-memory `OSRM_PBF` and `OSRM_GRAPH` selected by `select_pbf()` back to the env default.

## Fix

- `build_selected()` now validates the selected PBF without reloading env values.
- `all-downloaded` prints every discovered input before processing.
- Each loop item logs its index, selected PBF, and output graph.
- The script continues to the next downloaded file instead of silently returning to Australia.

## Recommended command

```bash
./prepare-osrm.sh all-downloaded
```

Use force only when deliberately rebuilding outputs:

```bash
./prepare-osrm.sh all-downloaded --force --yes
```
