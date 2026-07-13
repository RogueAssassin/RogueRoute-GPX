# RogueRoute-GPX Regional OSM Downloader

Use regional extracts instead of `planet.osm.pbf` for stable public routing. The downloader stores `.osm.pbf` files in `OSRM_DATA_DIR` and automatically registers them in `infra/docker/.env`.

```bash
./download-osm.sh list
./download-osm.sh core
./download-osm.sh popular
./download-osm.sh all
```

`list` also reports whether each local file is `missing`, `partial`, or
`downloaded`. Downloads use resumable `.part` files, retry transient network
errors, and validate the PBF before renaming it into place. Batch modes continue
after an individual failure and return a final list of failed region keys.
Temporary and preserved filenames are explicitly opened as PBF files, so
`osmium` does not reject a valid download merely because it ends in `.part` or
`.invalid-TIMESTAMP`. Previously preserved complete downloads are recovered
automatically before any new network transfer begins.

Core regions:

- Australia
- New Zealand
- Japan
- China
- United States mainland
- Hawaii
- Europe

Popular extras include South Korea, Taiwan, Singapore/Malaysia/Brunei, Indonesia, India, Canada, Mexico, Central America, South America, UK/Ireland, Germany, France, Spain, Italy, and the Netherlands.

Build prepared graphs:

```bash
./prepare-osrm.sh region australia
./prepare-osrm.sh all-downloaded
```

Preparation validates each input, skips ready graphs, backs up partial graphs,
and retries a failed build once with `OSRM_SAFE_THREADS`. Per-file logs are kept
under `OSRM_DATA_DIR/_build-logs`.

Switch active graph:

```bash
./switch-osrm-region.sh japan
```

The web UI can call the same switcher when `OSRM_SWITCH_ENABLED=true`.
