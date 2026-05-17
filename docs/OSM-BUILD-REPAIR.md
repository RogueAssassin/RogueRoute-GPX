# OSM / OSRM build repair

Use this when some downloaded `.osm.pbf` files fail during `osrm-extract`, `osrm-partition`, or `osrm-customize`.

## Recommended repair flow

```bash
./prepare-osrm.sh repair list
./repair-osm-builds.sh
```

`repair-osm-builds.sh` runs a normal repair pass first. If anything still fails, it retries with `OSRM_SAFE_THREADS=2`, which is slower but much safer on memory-constrained machines.

Logs are written under:

```bash
$OSRM_DATA_DIR/_build-logs/
```

## Rebuild one broken file

```bash
./prepare-osrm.sh repair list
./prepare-osrm.sh repair <index> --force --yes
```

`--force` moves matching old `.osrm*` outputs into `_osrm-backups`; it does not delete the downloaded `.osm.pbf` input.

## Common causes

- Not enough RAM for large regions, especially `europe`, `us`, or planet-level extracts.
- Not enough free disk for expanded `.osrm*` outputs.
- Interrupted earlier build left partial `.osrm*` files.
- Corrupt or incomplete `.osm.pbf` download.

## Safer settings

Set this in `infra/docker/.env` for retries:

```bash
OSRM_SAFE_THREADS=2
```

For very large regions, use smaller extracts where possible rather than building the full continent.
