# Troubleshooting

## `fetch failed` in the web UI
Usually means the frontend loaded but the routing backend or API path is unreachable.

Check:
```bash
./status.sh
./logs.sh
./logs-valhalla.sh
curl -v http://127.0.0.1:8002/status
```

## Valhalla says `Nothing to do`
This means no tiles and no `.osm.pbf` files were found in `/custom_files`.

Fix:
- confirm `VALHALLA_DATA_PATH` in `infra/docker/.env`
- confirm the mounted host path exists
- place `.osm.pbf` files directly in the mounted folder
- restart with `./deploy-valhalla.sh`

## Missing env file
If deploy scripts stop with an env error:
```bash
cp infra/docker/.env.example infra/docker/.env
```

## Port already in use
The helper scripts warn if ports like `9080` or `8002` are already in use. Review with:
```bash
sudo ss -tulpn | grep -E '9080|8002'
```

## WSL path issues
If the Windows drive is not visible in WSL, check:
```bash
ls -lah /mnt/h
ls -lah /mnt/h/Valhalla
```
