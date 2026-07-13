# Troubleshooting

## GPX has too many track points

Use `Automatic (recommended)` in the GPX detail selector. It keeps route leg
boundaries and meaningful path bends while removing duplicate/noisy geometry.
The Operations Deck shows both the source and exported track-point counts.

Use `Compact` for a stricter target. `Full geometry` is intended for software
known to handle large files and may exceed 2,000 points.

Server defaults can be changed in `infra/docker/.env`:

```env
GPX_MAX_TRACK_POINTS=1000
GPX_SIMPLIFY_TOLERANCE_METERS=2.5
```

## A batch OSM download did not finish every region

Read the summary at the end of the command, then run it again. Valid completed
files are reused and `.part` downloads resume:

```bash
./download-osm.sh popular
./download-osm.sh list
```

Invalid files are preserved with an `.invalid-TIMESTAMP` suffix instead of
being accepted as OSM data. Install `osmium-tool` (included by the dependency
installer) for structural validation.

Older builds incorrectly let `osmium` infer the format from the temporary
`.osm.pbf.part` suffix. If a complete file was preserved because of that bug,
the corrected downloader detects it automatically:

```bash
./download-osm.sh new-zealand
./download-osm.sh australia
```

The log will say `Recovered previously downloaded PBF without downloading it
again`. Full validation is enabled by default with `OSM_VERIFY_FULL=true`.

## OSRM container is unhealthy

If `osrm-extract`, `osrm-partition`, and `osrm-customize` all finish but an
older RogueRoute build reports `OSRM graph is incomplete after build`, update
RogueRoute before rebuilding. Older checks expected the obsolete
`.osrm.nodes` filename; current OSRM writes `.osrm.nbg_nodes` and
`.osrm.mldgr`. The completed graph can normally be reused without repeating
the expensive preparation step.

```bash
./verify-osrm.sh
docker logs rogueroute-osrm --tail=200
```

Common causes:

- `OSRM_DATA_DIR` is wrong.
- The active `OSRM_GRAPH` has not been created yet.
- `prepare-osrm.sh` was interrupted.
- The `.osrm*` files were built with a different profile or incomplete output.

Repair flow:

```bash
./prepare-osrm.sh repair list
./prepare-osrm.sh repair 3
```

Use `--force --yes` only when you want stale `.osrm*` outputs moved to `_osrm-backups/` before rebuild.

`all-downloaded` automatically moves unusable partial graphs to that backup
folder and retries failures once with `OSRM_SAFE_THREADS`. Inspect per-region
logs under `OSRM_DATA_DIR/_build-logs` when a safe retry also fails.

## Route generation errors

Confirm the web health endpoint:

```bash
curl http://127.0.0.1:9080/api/health
```

Confirm OSRM is responding:

```bash
curl 'http://127.0.0.1:5000/nearest/v1/foot/144.9631,-37.8136'
```

Check logs:

```bash
./logs.sh
docker logs rogueroute-osrm --tail=200
```

## NoSegment / waypoint cannot be snapped

- Confirm `ROUTER_MODE=osrm`.
- Confirm the selected points are inside your processed OSRM extract.
- RogueRoute automatically tries progressively larger real OSRM path searches
  from `OSRM_SNAP_RADIUS_METERS` up to `OSRM_SNAP_MAX_RADIUS_METERS` while
  keeping strict routing enabled. The default range is 250m to 1500m.
- The map marks an unrecoverable waypoint in red and shows successful snap
  corrections as amber dashed lines.
- If 1500m is inappropriate for your use case, adjust the maximum in
  `infra/docker/.env`; use a smaller value for dense cities and a larger value
  only for remote portal data.
- Move the highlighted waypoint closer to a visible mapped road/path, or add
  the missing foot access/path to OpenStreetMap and rebuild the regional graph.
- Use manual override only when OSRM cannot route that leg.

## Route crosses water or buildings

- Confirm the OSRM region matches the route location.
- Confirm manual override is off.
- Add more waypoints on known roads/paths.
- Check whether OpenStreetMap has usable path coverage in that area.

## Planet build is too heavy

Use regional extracts instead. Planet-sized preprocessing can require very large amounts of RAM, swap, and disk.


## Next.js: Failed to find Server Action

If the browser console shows `Failed to find Server Action`, the request is usually from a stale browser tab, service cache, or a client bundle from a previous build. RogueRoute now keeps `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable in `infra/docker/.env` and passes it into the Docker build so Server Action IDs remain consistent across rebuilds.

Recovery steps:

```bash
./stop.sh
./clean-web.sh
cd infra/docker
docker compose -f docker-compose.yml -f docker-compose.osrm.yml build --no-cache gpx-web
docker compose -f docker-compose.yml -f docker-compose.osrm.yml up -d
```

Then hard-refresh the browser tab, or test once in a private/incognito window.


## `tsc: Permission denied` or `node_modules missing` during build

This means the local pnpm dependency folder is stale, incomplete, or was created by another user/root. Run:

```bash
./repair-deps.sh
./first-run.sh osrm
```

The installer now runs the same repair automatically before building, but this command is useful if you interrupted an install or copied the project between machines.
