# RogueRoute GPX (Valhalla Enhanced) Setup

## What Valhalla Enhanced gives you
RogueRoute-GPX (Valhalla Enhanced) adds land-aware routing and support for external map data. Use it when you want more realistic route generation and are comfortable managing `.osm.pbf` or tile data.

## What Valhalla needs
Valhalla must see one of the following inside the mounted `/custom_files` path:
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

## Recommended files for main play areas
Most users should start with regional `.osm.pbf` downloads instead of the full planet file.

### Suggested starting regions for Pokémon GO players
- **Australia / New Zealand**
  - `australia-oceania-latest.osm.pbf`
  - optional `australia-oceania/new-zealand-latest.osm.pbf`
- **United Kingdom / Europe**
  - `europe-latest.osm.pbf`
  - optional `europe/great-britain-latest.osm.pbf`
- **North America**
  - `north-america-latest.osm.pbf`
- **Asia**
  - `asia-latest.osm.pbf`
- **South America**
  - `south-america-latest.osm.pbf`
- **Africa**
  - `africa-latest.osm.pbf`

Start with the regions you actually play in most often, confirm routing works, then add more only if needed.

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

## Start Valhalla Enhanced
```bash
cd /opt/media-server/RogueRoute-GPX
./deploy-valhalla.sh
```

## Verify existing files before restarting after a crash
```bash
./verify-valhalla.sh
./restart-valhalla.sh
```

## Repair a broken tile loop
If Valhalla keeps restarting and logs mention unusable tiles, run:

```bash
cd /opt/media-server/RogueRoute-GPX
./verify-valhalla.sh
./repair-valhalla.sh
./deploy-valhalla.sh
```

This removes generated tiles and config files, but preserves your `.osm.pbf` source files.

## Check that Valhalla is running
```bash
./logs-valhalla.sh
curl -v http://127.0.0.1:8002/status
```

## Full-world size and hardware guidance
### Full-world download size
The current `planet-latest.osm.pbf` is about **86 GB**.

### Storage planning
For a full-world setup, plan for:
- **86 GB** raw planet file
- **300 GB to 500+ GB** total free SSD space for processing, tiles, and rebuild headroom

### Recommended hardware for full-world use
- **8 CPU cores** or more
- **32 GB RAM minimum**
- **64 GB RAM preferred**
- **500 GB+ SSD free space**

## Refresh repo without touching map data
```bash
./refresh-valhalla.sh
```
