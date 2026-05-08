# RogueRoute-GPX Regional OSM Downloader

Use regional extracts instead of `planet.osm.pbf` for stable public routing. The downloader stores `.osm.pbf` files in `OSRM_DATA_DIR` and automatically registers them in `infra/docker/.env`.

```bash
./download-osm.sh list
./download-osm.sh core
./download-osm.sh popular
./download-osm.sh all
```

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

Switch active graph:

```bash
./switch-osrm-region.sh japan
```

The web UI can call the same switcher when `OSRM_SWITCH_ENABLED=true`.
