# Troubleshooting

Start with:

```bash
./rogueroute-gpx doctor
./rogueroute-gpx osm status
./rogueroute-gpx logs
```

Log lines are prefixed: `[supervisor]`, `[osrm]`, `[maps]`; website
output is unprefixed.

## "no pod with name or ID pod_rogueroute-gpx found"

podman-compose keeps the container in a pod, and the container outlived its pod. Since v13.1.1,
`start`, `restart` and `update` remove both before starting. On an older checkout, clear them
by hand (map data, `.env` and the queue are kept):

```bash
podman rm -f rogueroute-gpx; podman pod rm -f pod_rogueroute-gpx; ./rogueroute-gpx start
```

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

`./rogueroute-gpx osm queue` (or the **Queue** tab of `/admin`) shows the step and reason.

- **Too large for this server**: the region is estimated to need more than 85% of the memory
  cap. Use a smaller region, raise `ROGUEROUTE_MEMORY_LIMIT` in `.env` and
  `./rogueroute-gpx restart`, or try it anyway with `./rogueroute-gpx osm retry REGION --force`.
- **Stopped by the memory watchdog**: free host memory fell below `ROGUEROUTE_MEMORY_FLOOR`, or
  the container neared its cap. The message says which. Other services may have needed the
  memory; retry at a quieter time, or use a smaller region.
- **Killed, most likely out of memory** during `extract`: the container reached its memory
  cap. Use a smaller region, or raise `ROGUEROUTE_MEMORY_LIMIT`, then
  `./rogueroute-gpx osm retry REGION`.
- **Not enough disk space**: free space in `OSRM_DATA_DIR` (about the download size for a
  download, three times the extract size for preparation), then retry.
- **Checksum mismatch**: the download was damaged; retry starts it cleanly.

Failed regions are skipped by automatic preparation until you retry them.

## Map work is slowing the server down

Preparation already runs at nice 10, idle disk priority and inside the memory cap. Set `ROGUEROUTE_PREPARE_NICE=19` and
`ROGUEROUTE_PREPARE_THREADS` to fewer cores in `.env`, then `./rogueroute-gpx restart` (the
queue resumes), or `./rogueroute-gpx osm queue pause` until a quieter time.

## "Region switching is cooling down"

A switch happened less than `OSRM_SWITCH_COOLDOWN_SECONDS` ago. Wait, or switch from the CLI
(`./rogueroute-gpx osm switch REGION`), which skips the cooldown.

## "These waypoints need the … map"

The waypoints are inside a catalog region that is not prepared. Download and prepare it. If
the message says the waypoints are not inside any single region, split the route, or pick a
region manually in the Map region panel.

## Cannot log in to /admin

- "Administration is turned off": `ADMIN_PASSWORD` is empty. Set it in `.env`, then
  `./rogueroute-gpx restart`.
- "Too many failed attempts": wait a minute. Behind a reverse proxy, make sure it sends
  `X-Forwarded-For`, or every visitor shares one limit.
- Logged out unexpectedly: logins last 12 hours, and a restart, an update or a new password
  logs everyone out.
- Behind HTTPS the session cookie is marked Secure when the proxy sends
  `X-Forwarded-Proto: https`.

## An update failed or the disk filled up during an update

An update keeps the current files until the new ones are ready, so it needs space for a second
copy of the region. Free space or delete regions you no longer use (**Delete files** in `/admin`
or `./rogueroute-gpx osm delete REGION --yes`), then `./rogueroute-gpx osm update REGION`.
Leftover `REGION-next.*` files from an interrupted update are replaced by the next attempt, and
`osm delete` removes them too.

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
