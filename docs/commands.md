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
| `./rogueroute-gpx logs` | Follow logs (website, supervisor, OSRM and jobs share one stream). |
| `./rogueroute-gpx doctor` | Check Compose config, map folder permissions, container health and OSRM state. |
| `./rogueroute-gpx config` | Effective non-secret settings. |
| `./rogueroute-gpx version` | Configured version. |

## Maps

These run inside the container through `docker exec` / `podman exec`, so the container must
be running.

| Command | Function |
| --- | --- |
| `./rogueroute-gpx osm list` | Regions with rough download and prepared sizes. |
| `./rogueroute-gpx osm status` | Active region, OSRM state, running job, and each region's state. |
| `./rogueroute-gpx osm download REGION…` | Download/resume extracts, MD5-checked. |
| `./rogueroute-gpx osm download-missing --yes` | Download every region not downloaded yet. |
| `./rogueroute-gpx osm prepare REGION…` | Build OSRM MLD graphs from downloaded extracts. |
| `./rogueroute-gpx osm prepare-downloaded --yes` | Prepare every downloaded, unprepared region. |
| `./rogueroute-gpx osm switch REGION` | Serve another prepared region now (skips the cooldown). |
| `./rogueroute-gpx osm verify REGION` | Check a region is prepared. |
| `./rogueroute-gpx osm job` | Follow the running download/prepare job. |
| `./rogueroute-gpx osm path` | Map folder inside the container (`/data`). |

Download and prepare run as background jobs in the container. Ctrl-C stops following the
output; the job keeps running. Only one job runs at a time.
