# Troubleshooting

## `Permission denied` when running `./install.sh` or `./deploy.sh`
Run:

```bash
cd /opt/media-server/RogueRoute-GPX
bash fix-permissions.sh
```

Then try again.

## Scripts still will not execute
Use:

```bash
bash install.sh
bash deploy.sh
```

This works even if the execute bit was stripped by a zip extractor or Windows tool.

## Valhalla says `Nothing to do`
This means Valhalla could not find:
- `.osm.pbf` files
- `valhalla_tiles.tar`
- or a `valhalla_tiles` directory

Check your `VALHALLA_DATA_PATH` and make sure the files are actually there.

## Repo refresh removed my custom files
The refresh scripts intentionally clean stale files from the repo. Keep important files either:
- committed to Git, or
- outside the repo, like Valhalla data in `/mnt/h/Valhalla`

## I want to start over cleanly without deleting map data
```bash
cd /opt/media-server/RogueRoute-GPX
./stop.sh
git fetch origin
git reset --hard origin/main
git clean -fdx -e infra/docker/.env -e infra/docker/.env.example
bash fix-permissions.sh
bash first-run.sh
./deploy.sh
```

## GitHub Desktop does not show my changes
Make sure you opened the repository folder itself, not a parent folder.
