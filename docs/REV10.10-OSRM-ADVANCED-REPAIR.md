# Rev10.10 OSRM Advanced Repair

Rev10.10 adds a preservation-first repair workflow for first server startup when some OSRM regions are partially prepared.

## Important safety rules

- `.osm.pbf` downloaded input files are never deleted by `prepare-osrm.sh`.
- Existing `.osrm*` outputs are not deleted during repair.
- Partial or stale `.osrm*` outputs are moved to `_osrm-backups/` before rebuilding.
- Ready graphs are skipped unless `--force` is supplied.
- Old backup folders can be pruned separately with `cleanup-backups`; this only touches `_osrm-backups/`.

## Check every downloaded PBF

```bash
./prepare-osrm.sh repair list
```

Status values:

- `ready` means the OSRM graph has the required MLD files and can be used.
- `partial` means some `.osrm*` files exist but required sidecars are missing.
- `missing` means the `.osm.pbf` has not been prepared yet.

## Repair one selected file

Use the index from `repair list`:

```bash
./prepare-osrm.sh repair 3
```

Or use the file name:

```bash
./prepare-osrm.sh repair australia-latest.osm.pbf
```

Or use a nested relative path:

```bash
./prepare-osrm.sh repair oceania/australia-latest.osm.pbf
```

## Repair all missing or partial files

```bash
./prepare-osrm.sh repair all --yes
```

This skips ready graphs and only rebuilds missing/partial ones.

## Force rebuild everything

```bash
./prepare-osrm.sh repair all --force --yes
```

This moves matching old `.osrm*` outputs into `_osrm-backups/` and rebuilds from the preserved `.osm.pbf` inputs.

## Clean old backup folders

```bash
./prepare-osrm.sh cleanup-backups --days 14 --yes
```

This only removes old folders under `_osrm-backups/`. It does not remove `.osm.pbf` inputs or active `.osrm*` graph files.
