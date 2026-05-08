### OSRM container is unhealthy

```bash
sudo ./verify-osrm.sh
sudo docker logs rogueroute-osrm --tail=200
```

Common causes:

- `OSRM_DATA_DIR` is wrong.
- `planet.osrm` has not been created yet.
- `prepare-osrm.sh` was interrupted.
- The `.osrm*` files were built with a different profile or incomplete output.

### Route generation errors

- Confirm the web health endpoint:

```bash
curl http://127.0.0.1:9080/api/health
```

- Confirm OSRM is responding:

```bash
curl 'http://127.0.0.1:5000/nearest/v1/foot/144.9631,-37.8136'
```

- Check logs:

```bash
sudo ./logs.sh
sudo docker logs rogueroute-osrm --tail=200
```

### Route still looks like it crosses water or buildings

- Confirm `ROUTER_MODE=osrm`.
- Confirm manual override is off.
- Confirm the selected points are inside your processed OSRM extract.
- Increase `OSRM_SNAP_RADIUS_METERS` slightly, for example `250`.
- Use closer waypoints where OSM path coverage is sparse.

### Planet build is too heavy

Use a regional extract instead. Planet is supported, but it is not the recommended default for most installs.