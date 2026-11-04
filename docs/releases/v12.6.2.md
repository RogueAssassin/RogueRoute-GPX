# RogueRoute GPX v12.6.2

RogueRoute GPX v12.6.2 fixes website region switching on Podman hosts.
It needs no configuration changes and no map data changes.

## Fixes

- Switching OSRM region from the website no longer fails with
  `network rogueroute-gpx was found but has incorrect label com.docker.compose.network`.
  `podman compose` created the private network without Docker Compose's labels, and the
  manager, which recreates OSRM with Docker Compose, refused to reuse it. The automatic
  rollback failed the same way.
- The private `rogueroute-gpx` network is now external and is created by `install.sh` and
  `./rogueroute` when missing, the same way as `media-net`. Existing networks are reused as
  they are; `./rogueroute stop` no longer removes it.
- Stable GHCR tags `12.6.2`, `12.6`, `12`, and `latest`.

## Upgrading

```bash
cd /opt/media-server/RogueRoute-GPX && git pull --ff-only
./rogueroute update
```
