# Troubleshooting

## Permission denied when running scripts
Run:

```bash
cd /opt/media-server/RogueRoute-GPX
bash fix-permissions.sh
```

## Wrong Node.js version or missing pnpm
RogueRoute GPX expects Node.js `22` for local install/build tasks.

If pnpm is missing, the scripts will try to activate it through Corepack. If that still fails, install pnpm manually and rerun `./install.sh`.

## `fetch failed` in the web UI
This usually means the frontend loaded but the routing backend is unreachable.

Check:

```bash
./doctor.sh
./status.sh
./logs.sh
./logs-valhalla.sh
curl -v http://127.0.0.1:8002/status
```

## Valhalla says `Nothing to do`
Your Valhalla data path does not contain `.osm.pbf` files or built tiles.

Add region files or existing tiles to `VALHALLA_DATA_PATH`, then run:

```bash
./verify-valhalla.sh
./deploy-valhalla.sh
```

## Valhalla keeps restarting with unusable tiles
Run:

```bash
cd /opt/media-server/RogueRoute-GPX
./verify-valhalla.sh
./repair-valhalla.sh
./deploy-valhalla.sh
```

## Reboot or crash recovery
### Standard
```bash
./restart.sh
./status.sh
./logs.sh
```

### Valhalla Enhanced
```bash
./verify-valhalla.sh
./restart-valhalla.sh
./logs-valhalla.sh
```

## Repo refresh while preserving map data
Run:

```bash
./refresh.sh
./refresh-valhalla.sh
```
