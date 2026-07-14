# RogueRoute GPX v12 — standalone Docker deployment

This folder is independent of Rogue Dashboard and any media-server Compose
stack. It creates its own `rogueroute-gpx` Docker network and pulls the
prebuilt web application from:

```text
ghcr.io/rogueassassin/rogueroute-gpx:v12
```

Node.js, pnpm, TypeScript and Next.js compilation are not required on the
server. Existing prepared OSRM files remain under `/mnt/h/osrm` by default.

## Replace an older `/opt/media-server/RogueRoute-GPX` installation

Extract this standalone folder somewhere outside the existing installation,
then run:

```bash
sudo ./install.sh --target /opt/media-server/RogueRoute-GPX
```

The installer:

1. Stops only the old RogueRoute containers.
2. Refuses to continue if `OSRM_DATA_DIR` is inside the application folder.
3. Moves the old application to a timestamped sibling backup.
4. Reuses the old `.env` where available.
5. Forces the v12 GHCR image and 5000m strict snap maximum.
6. Starts the new standalone Compose stack.

It does not join `media-net`, modify Rogue Dashboard, or delete `/mnt/h/osrm`.

If the GHCR package is private, authenticate before starting it:

```bash
echo 'YOUR_GITHUB_TOKEN' | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

Use a token with `read:packages` only. Public packages do not require login.

## Daily commands

```bash
./start.sh
./stop.sh
./restart.sh
./status.sh
./logs.sh
./switch-region.sh new-zealand
./switch-region.sh australia
```

Edit `.env` to change ports, map-data location, active graph or image tag.

## Updating

Keep `ROGUEROUTE_IMAGE_TAG=v12` for reproducible v12 deployments, then run:

```bash
./restart.sh
```

Use `ROGUEROUTE_IMAGE_TAG=latest` only if you intentionally want every newly
published release.

## Rollback

The migration prints the exact timestamped backup path. Stop v12, move its
directory aside, and rename that backup to `RogueRoute-GPX`. Map graphs do not
need restoring because they stay in the external OSRM data folder.
