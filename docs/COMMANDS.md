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
