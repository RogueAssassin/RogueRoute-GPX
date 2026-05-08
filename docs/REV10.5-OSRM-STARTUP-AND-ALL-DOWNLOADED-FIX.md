# Rev10.5 OSRM startup and all-downloaded fix

## Fixed

- Removed the OSRM container healthcheck dependency that could mark large graphs unhealthy while `osrm-routed` was still loading.
- `gpx-web` now depends on OSRM being started, not Docker healthcheck healthy. The web API can retry/report OSRM availability itself.
- `prepare-osrm.sh all-downloaded` now searches recursively under `OSRM_DATA_DIR`.
- `prepare-osrm.sh pbf` now accepts:
  - filenames in `OSRM_DATA_DIR`
  - relative paths below `OSRM_DATA_DIR`
  - absolute paths inside `OSRM_DATA_DIR`
- Added `prepare-osm.sh` as a compatibility wrapper for the common typo/memory path.
- Forced rebuild cleanup now supports nested PBF folders safely and only deletes matching `.osrm*` outputs for the selected PBF.

## Recommended commands

```bash
cd /opt/media-server/RogueRoute-GPX
./stop.sh
./prepare-osrm.sh all-downloaded --force
./deploy.sh osrm
```

The typo-safe wrapper also works:

```bash
./prepare-osm.sh all-downloaded --force
```
