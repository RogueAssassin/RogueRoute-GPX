# Troubleshooting

## Clean refresh did not preserve settings
The refresh scripts preserve `infra/docker/.env`, but they intentionally remove other stale untracked files.
Keep anything important either:
- committed to Git, or
- outside the repo, such as Valhalla map data in `/mnt/h/Valhalla`

## Valhalla data disappeared after repo refresh
The map data should not live inside the repo. Use a host path such as `/mnt/h/Valhalla` and set:

```env
VALHALLA_DATA_PATH=/mnt/h/Valhalla
```

## `git clean` feels too destructive
Use the provided wrappers instead of ad-hoc cleanup:
```bash
./refresh.sh
./refresh-valhalla.sh
```

They preserve `infra/docker/.env` and rely on your external Valhalla data path.

## GitHub Desktop does not show changes
Make sure you opened the repository folder itself, not a parent directory. In GitHub Desktop, use **File -> Add Local Repository** if needed.
