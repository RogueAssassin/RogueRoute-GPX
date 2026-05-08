# Rev10.6 OSRM no-delete prepare fix

This release changes `./prepare-osrm.sh` to be preservation-first.

## Fixed

- `./prepare-osrm.sh all-downloaded --force` no longer deletes existing OSRM outputs.
- Existing `.osrm*` files are moved into `OSRM_DATA_DIR/_osrm-backups/` before a forced rebuild.
- Downloaded `.osm.pbf` input files are never deleted by the prepare script.
- `all-downloaded` now continues through every discovered `.osm.pbf` file instead of resetting back to the `.env` selection.
- Ready graphs are skipped automatically unless `--force` is used.
- Partial graphs are left untouched unless `--force` is used; without force, the script logs the issue and moves to the next file.

## Recommended command

```bash
./prepare-osrm.sh all-downloaded --force
```

For no delay:

```bash
./prepare-osrm.sh all-downloaded --force --yes
```

## Backup location

Forced rebuilds move old prepared outputs here:

```text
<OSRM_DATA_DIR>/_osrm-backups/
```

Only files matching the selected graph base are moved, for example:

```text
australia-latest.osrm*
```

The matching `.osm.pbf` input is preserved.
