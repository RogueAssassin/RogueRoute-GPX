# Valhalla Setup

## What Valhalla needs
Valhalla must see one of the following in its mounted `/custom_files` path:
- one or more `.osm.pbf` files
- `valhalla_tiles.tar`
- a `valhalla_tiles` directory

If none of those exist, Valhalla will stop with a `Nothing to do` error.

## Recommended location for map data
Keep map data outside the Git repo. Example for WSL:

```text
/mnt/h/Valhalla
```

That lets you refresh or fully reset the repo without deleting your routing data.

## Docker env example
Edit `infra/docker/.env`:

```env
VALHALLA_DATA_PATH=/mnt/h/Valhalla
ROUTER_MODE=valhalla
VALHALLA_URL=http://valhalla:8002
VALHALLA_PREFER_PBF_REBUILD=true
VALHALLA_SMART_REPAIR=true
```

## Smart Valhalla behavior in v7.5.0
RogueRoute GPX checks the contents of `VALHALLA_DATA_PATH` and follows a simple plan:
- `planet-latest.osm.pbf` found: treat the folder as a planet-build source
- multiple `.osm.pbf` files found: treat the folder as a regional-build source
- built tiles only found: load the existing tiles directly
- source `.osm.pbf` files plus stale generated tiles found: if smart repair is enabled, purge the generated outputs and rebuild from the source files

This makes the common broken-tile loop much easier to recover from.

## Approximate full-world size and hardware guidance
### Full-world download size
The current `planet-latest.osm.pbf` is about **86 GB**.

### Storage planning
For a full-world setup, plan for:
- **86 GB** raw planet file
- **300 GB to 500+ GB** total free SSD space for processing, tiles, and rebuild headroom

### Recommended hardware for full-world use
Project recommendation:
- **8 CPU cores** or more
- **32 GB RAM minimum**
- **64 GB RAM preferred**
- **500 GB+ SSD free space**

## Better option for most users
Regional packs are easier to download, easier to rebuild, and easier to update.

Recommended packs:
- Australia-Oceania
- Europe
- North America
- Asia
- South America
- Africa
- Great Britain
- New Zealand

## Example regional downloads
```bash
cd /mnt/h/Valhalla
wget https://download.geofabrik.de/australia-oceania-latest.osm.pbf
wget https://download.geofabrik.de/europe-latest.osm.pbf
wget https://download.geofabrik.de/north-america-latest.osm.pbf
wget https://download.geofabrik.de/asia-latest.osm.pbf
wget https://download.geofabrik.de/south-america-latest.osm.pbf
wget https://download.geofabrik.de/africa-latest.osm.pbf
wget https://download.geofabrik.de/europe/great-britain-latest.osm.pbf
wget https://download.geofabrik.de/australia-oceania/new-zealand-latest.osm.pbf
```

## Start Valhalla stack
```bash
cd /opt/media-server/RogueRoute-GPX
./deploy-valhalla.sh
```

## Repair a broken tile loop
If Valhalla keeps restarting and logs mention unusable tiles, run:

```bash
cd /opt/media-server/RogueRoute-GPX
./repair-valhalla.sh
./deploy-valhalla.sh
```

This removes generated tiles and config files, but preserves your `.osm.pbf` source files.

## Check that Valhalla is running
```bash
./logs-valhalla.sh
curl -v http://127.0.0.1:8002/status
```

## Refresh repo without touching map data
```bash
./refresh-valhalla.sh
```
