# OSM downloads and OSRM graphs

All map administration is handled by one command:

```bash
./rogueroute osm list
./rogueroute osm download REGION
./rogueroute osm prepare REGION
./rogueroute osm switch REGION
```

Downloads use Geofabrik, retry transient errors, and resume the `.part` file on
the next run. A failed region leaves its partial file intact.

Preparation runs `osrm-extract`, `osrm-partition`, and `osrm-customize` inside
the OSRM container. It reports success only when the MLD graph, partition, and
cell-metrics files exist.

Large regions need substantial RAM, temporary disk, and time. Prefer a country
or sub-region over continent and planet extracts. Never store map data inside
the application directory; keep it in `/mnt/h/osrm`,
`/var/lib/rogueroute/osrm`, or another dedicated volume.

To download several extracts in one batch:

```bash
./rogueroute osm download new-zealand australia japan
```

Every requested region is attempted and any failures are summarized at the
end. Re-run the same command to resume.
