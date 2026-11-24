# Troubleshooting

Start with:

```bash
./rogueroute-gpx doctor
./rogueroute-gpx osm status
./rogueroute-gpx logs
```

Log lines are prefixed: `[supervisor]`, `[osrm]`, `[maps]`; website
output is unprefixed.

## Image cannot be pulled

Check that the publish workflow for the version in `VERSION` finished and that the GHCR
package is public. For a private package, log in with a token limited to `read:packages`.

## OSRM state is `no-graph`

No region is prepared yet:

```bash
./rogueroute-gpx osm add REGION
```

## OSRM state is `failed`

The log shows why `osrm-routed` stopped. Common causes:

- **Not enough memory** for the graph (the process is killed). Use a smaller region.
- **Graph built by an older OSRM release.** Graph formats change between OSRM versions.
  Delete that region's `*.osrm*` files and run `./rogueroute-gpx osm add REGION` again.
- A crash while serving is restarted automatically up to five times with backoff.

## A region shows Failed on /maps

`./rogueroute-gpx osm queue` (or Map administration on `/maps`) shows the step and reason.

- **Killed, most likely out of memory** during `extract`: the host or container does not have
  enough RAM for that extract. Use smaller country regions instead, add memory or swap, then
  `./rogueroute-gpx osm retry REGION`.
- **Not enough disk space**: free space in `OSRM_DATA_DIR` (about the download size for a
  download, three times the extract size for preparation), then retry.
- **Checksum mismatch**: the download was damaged; retry starts it cleanly.

Failed regions are skipped by automatic preparation until you retry them.

## Map work is slowing the server down

Preparation already runs at nice 10. Set `ROGUEROUTE_PREPARE_NICE=19` and
`ROGUEROUTE_PREPARE_THREADS` to fewer cores in `.env`, then `./rogueroute-gpx restart` (the
queue resumes), or `./rogueroute-gpx osm queue pause` until a quieter time.

## "Region switching is cooling down"

A switch happened less than `OSRM_SWITCH_COOLDOWN_SECONDS` ago. Wait, or switch from the CLI
(`./rogueroute-gpx osm switch REGION`), which skips the cooldown.

## "These waypoints need the … map"

The waypoints are inside a catalog region that is not prepared. Download and prepare it. If
the message says the waypoints are not inside any single region, split the route, or pick a
region manually in the Map region panel.

## Downloads or preparation fail with permission errors

The map folder must be writable by `PUID:PGID`:

```bash
sudo ./rogueroute-gpx permissions
```

On rootless Podman, make sure you run the script as your normal account (not `sudo`), so
`compose.podman.yaml` applies (container root = your account).

## OSRM reports NoSegment

Routing searches from `OSRM_SNAP_RADIUS_METERS` up to `OSRM_SNAP_MAX_RADIUS_METERS` (250 to
5,000 m by default). Confirm the coordinate is inside the served region and that the profile
has a routable way nearby.

## Rogue Dashboard shows red

The container answers as `rogueroute-gpx-web` on the `rogueroute-gpx` and `media-net`
networks. Check membership:

```bash
docker network inspect rogueroute-gpx --format '{{range .Containers}}{{println .Name}}{{end}}'
```

`/api/health/osrm` is red while OSRM loads or switches a graph; that is expected for the
duration of the load.
