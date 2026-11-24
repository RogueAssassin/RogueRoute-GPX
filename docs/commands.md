# Command reference

Run `./rogueroute-gpx help` or `./rogueroute-gpx osm help`. The old `./rogueroute` name still
works and forwards to `./rogueroute-gpx`.

## Container

| Command | Function |
| --- | --- |
| `./rogueroute-gpx start` | Pull the pinned image and start the container. |
| `./rogueroute-gpx stop` | Stop and remove the container. Map data is kept. |
| `./rogueroute-gpx restart` | Pull and recreate the container. |
| `./rogueroute-gpx update` | Apply `VERSION` from Git, remove the v12 containers if present, pull and recreate. |
| `sudo ./rogueroute-gpx permissions` | Give your account the checkout, `.env` and map folder. |
| `./rogueroute-gpx status` | Container state. |
| `./rogueroute-gpx logs` | Follow logs (website, supervisor, OSRM and the map queue share one stream). |
| `./rogueroute-gpx doctor` | Check Compose config, map folder permissions, container health and OSRM state. |
| `./rogueroute-gpx config` | Effective non-secret settings. |
| `./rogueroute-gpx version` | Configured version. |

## Maps

These run inside the container through `docker exec` / `podman exec`, so the container must
be running.

| Command | Function |
| --- | --- |
| `./rogueroute-gpx osm list` | Regions with rough download and prepared sizes. |
| `./rogueroute-gpx osm status` | Active region, OSRM state, map queue, free disk and each region's state. |
| `./rogueroute-gpx osm add REGION… [--wait]` | Queue regions: download if needed, then prepare. `prepare` does the same. |
| `./rogueroute-gpx osm download REGION… [--wait]` | Queue downloads only (resumable, MD5-checked). |
| `./rogueroute-gpx osm prepare-downloaded [--yes]` | Queue every downloaded, unprepared region. |
| `./rogueroute-gpx osm prepare-all --yes` | Queue every catalog region (very large). |
| `./rogueroute-gpx osm download-missing --yes` | Queue downloads of every region not downloaded yet. |
| `./rogueroute-gpx osm queue` | Task in progress, waiting regions and failures. |
| `./rogueroute-gpx osm queue pause` / `resume` / `cancel` / `clear` | Control the queue. |
| `./rogueroute-gpx osm queue remove REGION…` | Take regions out of the queue. |
| `./rogueroute-gpx osm retry [REGION…]` | Queue failed regions again (all of them by default). |
| `./rogueroute-gpx osm follow` | Follow the map log until the queue is empty. |
| `./rogueroute-gpx osm switch REGION` | Serve another prepared region now (skips the cooldown). |
| `./rogueroute-gpx osm verify REGION` | Check a region is prepared. |
| `./rogueroute-gpx osm path` | Map folder inside the container (`/data`). |

Map work runs in a background queue inside the container, one region at a time, smallest
first. It keeps running when you close the terminal and resumes after a restart. Ctrl-C only
stops following the output. The website shows the same progress at `/maps`.
