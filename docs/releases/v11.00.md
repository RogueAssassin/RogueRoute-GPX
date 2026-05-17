# RogueRoute GPX v11

## Release focus

v11 is a cleanup and reliability release focused on safer rebuilds, cleaner OSRM startup behaviour, and clearer recovery steps when large `.osm.pbf` extracts fail during preparation.

## Highlights

- Bumped public build label to `v11`.
- Bumped workspace package versions to npm-safe `11.0.0`.
- Added OSRM runtime graph validation before OSRM restarts/deploys.
- Changed OSRM container restart behaviour from endless restart loops to limited failure retries.
- Added `./diagnose-osrm.sh` to show graph status, Compose status, and recent OSRM logs in one command.
- Kept dependency repair integrated before local builds so broken/root-owned `node_modules` can be repaired automatically.
- Refreshed docs for clean rebuilds, dependency repair, OSM/OSRM recovery, and v11 release handling.

## Upgrade commands

```bash
bash fix-permissions.sh
./repair-deps.sh
./diagnose-osrm.sh
./clean-rebuild.sh osrm
```

If OSRM graph files are missing or incomplete:

```bash
./prepare-osrm.sh repair list
./repair-osm-builds.sh
./diagnose-osrm.sh
./restart.sh osrm
```

## Notes

The UI may show `v11`, while npm package metadata uses `11.0.0` because npm semver should not use a leading-zero minor version.
