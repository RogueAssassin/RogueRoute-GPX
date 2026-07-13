# RogueRoute-GPX command reference

## First run

```bash
bash fix-permissions.sh
./first-run.sh
```

## Standard/direct fallback mode

```bash
./deploy.sh standard
./status.sh
./logs.sh
./stop.sh
```

## OSRM mode

```bash
./download-osm.sh list
./download-osm.sh australia
./download-osm.sh popular
./prepare-osrm.sh region australia
./deploy.sh osrm
./status.sh
./logs.sh
./verify-osrm.sh
```

## Prepare all downloaded PBF files

```bash
./prepare-osrm.sh all-downloaded --yes
```

Batch downloads continue after individual failures and can be resumed by
running the same command again. `all-downloaded` retries failed OSRM builds once
with `OSRM_SAFE_THREADS` and keeps per-region logs in `_build-logs`.

## GPX geometry defaults

```env
GPX_MAX_TRACK_POINTS=1000
GPX_SIMPLIFY_TOLERANCE_METERS=2.5
```

The web UI offers Automatic, Compact, and Full geometry export modes.

## Strict routing snap recovery

```env
OSRM_SNAP_RADIUS_METERS=250
OSRM_SNAP_MAX_RADIUS_METERS=1500
```

The first value is the initial nearest-path search. RogueRoute progressively
expands to the maximum only after OSRM returns `NoSegment`; it never substitutes
a straight manual leg unless Manual override is explicitly enabled.

## OSRM repair commands

```bash
./prepare-osrm.sh repair list
./prepare-osrm.sh repair 3
./prepare-osrm.sh repair australia-latest.osm.pbf
./prepare-osrm.sh repair all --yes
./prepare-osrm.sh repair all --force --yes
./prepare-osrm.sh cleanup-backups --days 14 --yes
```

`repair list` shows every `.osm.pbf` under `OSRM_DATA_DIR` and marks each item as `ready`, `partial`, or `missing`. Repair never deletes `.osm.pbf` inputs. Old matching `.osrm*` outputs are moved to `_osrm-backups/` before rebuild.

## Update helpers

```bash
./version-check.sh
./update.sh osrm
./restart.sh
```
