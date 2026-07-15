# Troubleshooting

## Image cannot be pulled

Confirm that the v12.3.0 GitHub Release workflow completed and that the GHCR
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
`OSRM_SNAP_MAX_RADIUS_METERS`. v12.3.0 defaults to 250–5,000 m. Confirm the
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
