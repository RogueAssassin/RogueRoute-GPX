# Troubleshooting

## Permission denied when running scripts
Run:

```bash
cd /opt/media-server/RogueRoute-GPX
bash fix-permissions.sh
```

## `fetch failed` in the web UI
This usually means the frontend loaded but the routing backend is unreachable.

Check:

```bash
./status.sh
./logs.sh
./logs-valhalla.sh
curl -v http://127.0.0.1:8002/status
```

## Valhalla says `Nothing to do`
Your Valhalla data path does not contain `.osm.pbf` files or built tiles.

## Valhalla keeps restarting with unusable tiles
Run:

```bash
cd /opt/media-server/RogueRoute-GPX
./repair-valhalla.sh
./deploy-valhalla.sh
```

## Repo refresh while preserving map data
Run:

```bash
./refresh.sh
./refresh-valhalla.sh
```
