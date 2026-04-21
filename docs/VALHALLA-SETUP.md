# Valhalla Setup

## Requirement
Valhalla needs one of the following inside the mounted `/custom_files` path:
- one or more `.osm.pbf` files
- `valhalla_tiles.tar`
- `valhalla_tiles` directory

If none are present, it will fail with a `Nothing to do` error.

## WSL host path
If your Ubuntu box runs in WSL and you created `H:\Valhalla` on Windows, the path is usually:

```text
/mnt/h/Valhalla
```

## Keep map data outside the repo
The recommended layout is to keep Valhalla map data outside the Git working tree. For example:

```text
/mnt/h/Valhalla
```

That way you can refresh or fully clean the repo without deleting map packs or built tiles.

## Example `infra/docker/.env`
```env
VALHALLA_DATA_PATH=/mnt/h/Valhalla
ROUTER_MODE=valhalla
VALHALLA_URL=http://valhalla:8002
```

## Example compose override
```yaml
services:
  gpx-web:
    environment:
      ROUTER_MODE: valhalla
      VALHALLA_URL: http://valhalla:8002
    depends_on:
      - valhalla

  valhalla:
    image: ghcr.io/gis-ops/docker-valhalla/valhalla:latest
    container_name: valhalla
    restart: unless-stopped
    ports:
      - "8002:8002"
    networks:
      - media-net
    volumes:
      - ${VALHALLA_DATA_PATH}:/custom_files
```

## Recommended regional downloads
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

## Start the full stack
```bash
cd /opt/media-server/RogueRoute-GPX
cp infra/docker/.env.example infra/docker/.env  # first time only
./deploy-valhalla.sh
```

## Refresh the repo without deleting map data
```bash
cd /opt/media-server/RogueRoute-GPX
./refresh-valhalla.sh
```

This works safely because the map data path is outside the repo.

## Verify
```bash
./logs-valhalla.sh
curl -v http://127.0.0.1:8002/status
docker exec -it gpx-web sh -c 'wget -qO- http://valhalla:8002/status'
```
