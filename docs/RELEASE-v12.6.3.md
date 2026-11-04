# RogueRoute GPX v12.6.3

RogueRoute GPX v12.6.3 completes the Podman region-switching fix from v12.6.2.
It needs no configuration changes and no map data changes.

## Fixes

- Switching OSRM region from the website no longer fails with
  `the container name "rogueroute-gpx-osrm" is already in use`. On Podman hosts the stack is
  started by `podman compose`, and the manager recreates OSRM with Docker Compose, which does
  not recognise that container as its own. The manager now removes the current OSRM container
  before recreating it, including during the automatic rollback.
- `./rogueroute start`, `restart` and `update` replace an OSRM container that the region
  switcher created, and `./rogueroute osm switch` frees the container name before recreating
  OSRM, so the host and the website can switch regions in any order.
- Stable GHCR tags `12.6.3`, `12.6`, `12`, and `latest`.

## Upgrading

```bash
cd /opt/media-server/RogueRoute-GPX && git pull --ff-only
./rogueroute update
```
