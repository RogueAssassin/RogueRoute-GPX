# RogueRoute-GPX Commands

```bash
./first-run.sh
./install.sh osrm
./prepare-osrm.sh
./deploy.sh osrm
./status.sh
./logs.sh
./verify-osrm.sh
./version-check.sh
./update.sh osrm
./stop.sh
```

Use `./deploy.sh standard` only for direct fallback testing.

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
