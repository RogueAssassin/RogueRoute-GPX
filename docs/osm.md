# Maps: download, prepare and switch

All map files live in `OSRM_DATA_DIR` on the host, mounted at `/data` in the container. The
region catalog (names, Geofabrik URLs, sizes and the areas used for automatic selection) is
[`regions.json`](../regions.json).

```bash
./rogueroute-gpx osm list
./rogueroute-gpx osm status
```

A region is `missing`, `partial` (interrupted download), `downloaded` or `prepared`.

## Download

```bash
./rogueroute-gpx osm download new-zealand
./rogueroute-gpx osm download australia japan
./rogueroute-gpx osm download-missing --yes
```

Downloads come from Geofabrik, retry up to five times and resume the `.part` file. The MD5
from Geofabrik is checked before the file gets its final `.osm.pbf` name. If the checksum
fails, the bad partial is kept with an `.invalid-<time>` suffix and the next attempt starts
cleanly. Check free space first (`df -h /mnt/h/osrm`): the whole catalog is very large.

## Prepare

```bash
./rogueroute-gpx osm prepare new-zealand
./rogueroute-gpx osm prepare-downloaded --yes
```

Preparation runs the upstream OSRM tools inside the container:

1. `osrm-extract -p /opt/foot.lua` (`OSRM_PROFILE`: `foot`, `bike` or `car`)
2. `osrm-partition`
3. `osrm-customize`

It needs a lot of RAM and disk for large regions; prefer country extracts. The region being
served cannot be rebuilt in place: switch to another region first. If no region was being
served, the first prepared region is loaded automatically.

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

Set `ADMIN_TOKEN` in `.env` and restart. The Map region panel then shows **Map
administration**: enter the token to download, prepare or load a region and follow the job
log. Without the token, visitors can only use prepared regions.

## Permissions

The container writes as `PUID:PGID` (your account). If files were created by root earlier,
repair once:

```bash
sudo ./rogueroute-gpx permissions
```
