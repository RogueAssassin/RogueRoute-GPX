# Command reference

Run `./rogueroute help` or `./rogueroute osm help` for the built-in reference.

## Container administration

| Command | Function |
| --- | --- |
| `./rogueroute start` | Verify the active graph, pull images and start web, manager and OSRM. |
| `./rogueroute stop` | Stop the stack without deleting external map data. |
| `./rogueroute restart` | Pull and recreate all three services. |
| `./rogueroute update` | Pull and apply the configured `ROGUEROUTE_VERSION`. |
| `./rogueroute status` | Display service state and health. |
| `./rogueroute logs [SERVICE]` | Follow all logs or only `web`, `manager` or `osrm`. |
| `./rogueroute doctor` | Validate Compose, the active graph and manager health. |
| `./rogueroute config` | Print effective non-secret settings. Internal tokens are never printed. |
| `./rogueroute version` | Display the configured application version. |

Website users do not need a switch key. The internal web-to-manager token is
stored in a private Docker volume rather than `.env`.

## Map administration

| Command | Function |
| --- | --- |
| `./rogueroute osm list` | List supported Geofabrik regions and approximate sizes. |
| `./rogueroute osm status` | Mark regions as missing, partial, downloaded or prepared. |
| `./rogueroute osm path` | Print the configured data directory. |
| `./rogueroute osm download REGION…` | Download/resume one or multiple extracts. |
| `./rogueroute osm prepare REGION` | Build an MLD foot-routing graph in the data directory. |
| `./rogueroute osm verify REGION` | Check the PBF and required runtime sidecars. |
| `./rogueroute osm switch REGION` | Update `.env` and recreate only OSRM. |

```bash
./rogueroute osm download new-zealand australia
./rogueroute osm prepare new-zealand
./rogueroute osm verify new-zealand
./rogueroute start
./rogueroute doctor
./rogueroute logs manager
```
