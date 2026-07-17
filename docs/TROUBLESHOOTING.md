# Troubleshooting

## Image cannot be pulled

Confirm that the v12.5.1 GitHub Release workflow completed and that the GHCR
package is public. For a private package, log in using a token limited to
`read:packages`.

## OSRM graph is missing

```bash
./rogueroute osm prepare REGION
```

The active `OSRM_GRAPH` must match files under `OSRM_DATA_DIR`, including
`.osrm.mldgr`, `.osrm.partition`, and `.osrm.cell_metrics`.

## A download appears incomplete

Run the same download command again. Curl resumes the `.part` file. The final
`.osm.pbf` name is used only after the transfer succeeds and exceeds the
minimum sanity size.

## OSRM reports NoSegment

RogueRoute searches progressively from `OSRM_SNAP_RADIUS_METERS` to
`OSRM_SNAP_MAX_RADIUS_METERS`. v12.5.1 defaults to 250–5,000 m. Confirm the
coordinate lies inside the prepared extract and that the foot profile contains
a routable nearby way.

## Useful diagnostics

```bash
./rogueroute config
./rogueroute status
./rogueroute logs web
./rogueroute logs osrm
docker inspect rogueroute-gpx-web
docker inspect rogueroute-gpx-osrm
```

## Web or OSRM is red in Rogue Dashboard

Update RogueRoute to v12.5.1 and Rogue Dashboard to 1.0.1, then ensure the
dashboard joins RogueRoute's private network:

```dotenv
RGDASH_EXTRA_NETWORK=rogueroute-gpx
```

Run `./upgrade.sh` from the dashboard checkout. The scripts detect this network
automatically when the setting is empty and the RogueRoute stack is already
running.

Confirm both native health and network membership:

```bash
docker inspect rogueroute-gpx-web rogueroute-gpx-osrm \
  --format '{{.Name}} {{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}'
docker network inspect rogueroute-gpx \
  --format '{{range $id, $container := .Containers}}{{println $container.Name}}{{end}}'
```

The dashboard cards check `/api/health` for Web and `/api/health/osrm` for the
routing engine. Do not point the OSRM card at the generic port-5000 root path.

## A container remains starting or unhealthy

```bash
./rogueroute status
./rogueroute doctor
docker inspect rogueroute-gpx-osrm --format '{{json .State.Health}}'
./rogueroute logs osrm
```

OSRM must load the active graph and listen on port 5000 before Docker marks it
healthy. Large graphs may need more than the default startup window; increase
`ROGUEROUTE_STARTUP_TIMEOUT_SECONDS` only after confirming that the OSRM log is
still making progress.
