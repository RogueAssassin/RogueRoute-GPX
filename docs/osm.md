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
- Build tools run at a lower CPU priority (`ROGUEROUTE_PREPARE_NICE`, default 10) and at idle
  disk priority (`ROGUEROUTE_PREPARE_IDLE_IO`), so routing, the website and other services on
  the host stay responsive. `ROGUEROUTE_PREPARE_THREADS` limits the cores they use.
- Map work runs inside a **memory cap** and under a **memory watchdog**, so a large region
  cannot take the host down (see Memory below).
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

### Memory

`osrm-extract` is the step that needs the most memory: roughly 5 times the `.osm.pbf` size
with the foot profile (4 for bike, 3 for car). Once a region has been prepared, its measured
peak is remembered and used instead. Three layers keep this from taking the host down:

1. **Memory cap.** `./rogueroute-gpx` caps the container at `ROGUEROUTE_MEMORY_LIMIT`
   (`auto` = 70% of host RAM, or a size such as `64g`, or `none`) with no extra swap. If the
   cap is reached, the kernel stops the map tool inside the container, never the rest of the
   host, and the website and `osrm-routed` keep running.
2. **Size check.** A region estimated to need more than 85% of the cap is not prepared:
   `osm add` refuses it, auto-prepare and `prepare-downloaded` skip it, and `/maps` marks it
   "Too large for this server". Add `--force` (or **Prepare anyway** on `/maps`) to try it
   anyway, still inside the cap.
3. **Watchdog.** While a tool runs, the supervisor checks memory every 2 seconds and stops the
   tool if free host memory falls below `ROGUEROUTE_MEMORY_FLOOR` (default 5% of RAM, at least
   2 GB) or the container reaches 95% of its cap. The region is marked failed with the reason.

`./rogueroute-gpx osm status` shows the cap, what map work may use and each region's estimate.
Continent extracts such as Europe (30+ GB) and the whole United States need a very large host;
country or state extracts are far smaller.

```bash
./rogueroute-gpx osm add us --force   # try a region that is over the estimate
```

The region being served cannot be rebuilt in place: switch to another region first.

## Adding any region

The built-in list covers popular countries and continents. Any other region Geofabrik
publishes (about 550: continents, countries, US states, German states, Canadian provinces,
French regions and more) can be added too, and a sub-region is usually the answer when a region
is too large for the server.

**On the website:** open `http://SERVER-IP:9080/maps/download`. Browse the tree or search, and
the map shows the region's outline, its sub-regions (click one to open it) and what is already
prepared. For each region you see the download size, the memory it needs to prepare, whether a
prepared region already covers it, and whether it is too large for this server. With the
admin token entered, **Download and prepare** or **Download only** add it to the region list and
the map queue.

**From the command line:**

```bash
./rogueroute-gpx osm search california      # find the Geofabrik id
./rogueroute-gpx osm add us/california      # add it to the list and queue it
./rogueroute-gpx osm add us-west us/oregon  # several at once; ids and list names can be mixed
```

Added regions behave like the built-in ones: they show on `/maps` under **Added regions**, are
used by automatic region selection, and are kept in `OSRM_DATA_DIR/.rogueroute-gpx/regions.json`.
An added region without map files can be taken off the list again on `/maps/download`.

The region list comes from Geofabrik's index (`index-v1.json`), downloaded once a week and kept
in `OSRM_DATA_DIR/.rogueroute-gpx/geofabrik-index.json`. **Update** on `/maps/download` fetches
it now. Its outlines are also used by automatic region selection, so waypoints are matched to a
region's real border instead of a rectangle around it.

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
