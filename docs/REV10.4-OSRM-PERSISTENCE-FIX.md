# Rev10.4 OSRM persistence fix

This revision prevents prepared OSRM graphs from being deleted and rebuilt accidentally.

## Fixed

- `prepare-osrm.sh` now skips `osrm-extract`, `osrm-partition`, and `osrm-customize` when the selected graph already has the required MLD files.
- Existing `${OSRM_GRAPH%.osrm}.osrm*` files are only removed when `--force` is explicitly supplied.
- Partial graphs are not auto-deleted. The script stops and asks for a `--force` rebuild instead.
- `refresh.sh` preserves `OSRM_DATA_DIR` if someone configures it inside the repository.
- OSRM env templates now use `australia-latest.osrm`, matching `australia-latest.osm.pbf`.

## Safe commands

```bash
./prepare-osrm.sh region australia
./deploy.sh osrm
./restart.sh osrm
```

These should not rebuild Australia once it is prepared.

## Forced rebuild

Only use this when you intentionally want to replace the prepared graph:

```bash
./prepare-osrm.sh region australia --force
```
