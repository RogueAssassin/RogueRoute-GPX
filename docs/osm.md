# Maps: queue, prepare and switch

All map files live in `OSRM_DATA_DIR` on the host, mounted at `/data` in the container. The
region catalog (names, Geofabrik URLs, sizes and the areas used for automatic selection) is
[`regions.json`](../regions.json).

```bash
./rogueroute-gpx osm list
./rogueroute-gpx osm status
```

A region is `missing`, `partial` (interrupted download), `downloaded` or `prepared`. The
website shows the same at **`/maps`**: what is ready, what is being built, and what is waiting.

## The map queue

You ask for regions; the container does the rest in the background:

```bash
./rogueroute-gpx osm add new-zealand japan       # download if needed, then prepare
./rogueroute-gpx osm prepare-downloaded          # everything downloaded but not prepared
./rogueroute-gpx osm follow                      # watch the log (Ctrl-C stops watching only)
```

- One region at a time, **smallest first**, so more regions become usable sooner.
- Build tools run at a lower CPU priority (`ROGUEROUTE_PREPARE_NICE`, default 10) so routing
  and the website stay responsive. `ROGUEROUTE_PREPARE_THREADS` limits the cores they use.
- The queue is saved in `OSRM_DATA_DIR/.rogueroute-gpx/queue.json`. After `update`, `restart`
  or a reboot it **resumes**: downloads continue from their `.part` file and an interrupted
  preparation starts that region again.
- With `ROGUEROUTE_AUTO_PREPARE=true` (the default), regions that are downloaded but not
  prepared are queued automatically when the container starts.
- A failed region is recorded with its reason and step, and the queue moves on. It is not
  retried automatically; run `./rogueroute-gpx osm retry` (all failed) or
  `./rogueroute-gpx osm retry REGION` after fixing the cause.
- If no region was being served, the first region to finish is loaded automatically.

Manage the queue:

```bash
./rogueroute-gpx osm queue                 # task in progress, waiting regions, failures
./rogueroute-gpx osm queue pause           # finish the current task, then stop
./rogueroute-gpx osm queue resume
./rogueroute-gpx osm queue cancel          # stop the current task now
./rogueroute-gpx osm queue remove japan
./rogueroute-gpx osm queue clear           # remove every waiting task
```

Add `--wait` to `add`, `prepare` or `download` to block until those regions finish and exit
non-zero if one fails (useful in scripts; `install.sh --start` uses it).

## Download

`./rogueroute-gpx osm download REGION…` queues a download only, and
`./rogueroute-gpx osm download-missing --yes` downloads every region that is missing.

Downloads come from Geofabrik, retry up to five times and resume the `.part` file. The queue
checks free disk space against the file size before starting. The MD5 from Geofabrik is
checked before the file gets its final `.osm.pbf` name; on a mismatch the bad partial is kept
with an `.invalid-<time>` suffix and the next attempt starts cleanly.

## Prepare

Preparation runs the upstream OSRM tools inside the container:

1. `osrm-extract -p /opt/foot.lua` (`OSRM_PROFILE`: `foot`, `bike` or `car`)
2. `osrm-partition`
3. `osrm-customize`

Before it starts, the queue removes leftovers of an earlier interrupted build of that region
and checks that about three times the extract size is free on disk.

**Memory.** `osrm-extract` needs roughly 2–3 times the `.osm.pbf` size in RAM. The queue logs a
warning when a region probably needs more than the container has. If the kernel kills the tool,
the region is marked failed with "killed, most likely out of memory" and the queue continues
with the next region. Continent extracts such as Europe (30+ GB) and the whole United States
need a very large host; the country extracts (Germany, France, Spain, Italy, UK and Ireland …)
are far smaller.

The region being served cannot be rebuilt in place: switch to another region first.

## Switching regions

You rarely need to switch by hand. When a route is generated, the website picks the prepared
region whose area contains every waypoint:

1. the region being served, if it matches (no switch);
2. otherwise the smallest matching prepared region (Germany before Europe).

If the waypoints span two regions, or the matching region is not prepared, the website says
so. Pick a region in the **Map region** panel to force one.

Switching stops `osrm-routed` and starts it on the other graph inside the same container, so
routing is unavailable while the new graph loads (seconds for a city-sized region, minutes for
a continent). A failed load restores the previous region. Switches are global, serialised,
and limited by `OSRM_SWITCH_COOLDOWN_SECONDS`; the CLI and an administrator on the website can
skip the cooldown:

```bash
./rogueroute-gpx osm switch new-zealand
```

## From the website

`/maps` is public and read-only: region states, the task in progress (step, download progress
and speed, time in the step) and the waiting list. It refreshes itself.

Set `ADMIN_TOKEN` in `.env` and restart to manage the queue there too. Enter the token in
**Map administration** at the bottom of `/maps` to queue, remove, retry or cancel regions,
pause or resume the queue, and read the map log with failure reasons, free disk space and
memory. Without the token, visitors only see progress and use prepared regions.

## Permissions

The container writes as `PUID:PGID` (your account). If files were created by root earlier,
repair once:

```bash
sudo ./rogueroute-gpx permissions
```
