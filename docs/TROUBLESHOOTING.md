# Troubleshooting

## OSRM container is unhealthy

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
- Move the waypoint closer to a visible road/path.
- Increase `OSRM_SNAP_RADIUS_METERS`, for example `250` or `500`.
- Use manual override only when OSRM cannot route that leg.

## Route crosses water or buildings

- Confirm the OSRM region matches the route location.
- Confirm manual override is off.
- Add more waypoints on known roads/paths.
- Check whether OpenStreetMap has usable path coverage in that area.

## Planet build is too heavy

Use regional extracts instead. Planet-sized preprocessing can require very large amounts of RAM, swap, and disk.
