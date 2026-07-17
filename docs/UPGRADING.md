# Upgrading and rollback

The production installation is a Git checkout. Machine settings and secrets
remain in the ignored `.env`, while map files remain in `OSRM_DATA_DIR`.

## Normal update

```bash
cd /opt/media-server/RogueRoute-GPX && git pull --ff-only
./rogueroute update
```

The first command updates the tracked deployment files. The second reads
`VERSION`, synchronizes `ROGUEROUTE_VERSION` in `.env`, pulls that exact GHCR
image and applies the Compose stack. It does not remove map data or regenerate
existing secrets.

Run `./rogueroute doctor` after an update. The matching GHCR release image must
have finished publishing before the second command can succeed.

v12.5.1 changes the default for new installations from the legacy Docker Hub
image to the current official
`ghcr.io/project-osrm/osrm-backend:v26.7.3` image. An existing `.env` remains
authoritative, so the normal application update does not silently replace its
OSRM runtime or rebuild a large graph.

To adopt the current OSRM image on an existing installation, first confirm the
active region's `.osm.pbf` is present. Stop the stack, update `OSRM_IMAGE` in
`.env`, rebuild the selected region with the new image, then start normally:

```bash
./rogueroute config
./rogueroute stop
# Edit .env: OSRM_IMAGE=ghcr.io/project-osrm/osrm-backend:v26.7.3
./rogueroute osm prepare REGION
./rogueroute start
```

OSRM storage formats may change between release families. Re-preparation is
required instead of attempting to run the new binary against an older graph.

If the checkout or map directory was previously populated with `sudo`, v12.5.1
reports the ownership problem instead of leaving mixed root-owned files. Repair
it once, then retry:

```bash
sudo ./rogueroute permissions
./rogueroute update
```

## Convert a copied/ZIP installation once

Stop the old stack, preserve `.env`, and clone into the final location:

```bash
cd /opt/media-server/RogueRoute-GPX && ./rogueroute stop
sudo mv /opt/media-server/RogueRoute-GPX /opt/media-server/RogueRoute-GPX-pre-git
sudo install -d -o "$USER" -g "$(id -gn)" /opt/media-server/RogueRoute-GPX
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git /opt/media-server/RogueRoute-GPX
sudo cp /opt/media-server/RogueRoute-GPX-pre-git/.env /opt/media-server/RogueRoute-GPX/.env
cd /opt/media-server/RogueRoute-GPX
sudo ./install.sh --data-dir /mnt/h/osrm --region new-zealand
```

Keep the old directory until a known route succeeds.

## Rollback

Check out a known release, then apply its version:

```bash
git fetch --tags
git checkout v12.4.0
./rogueroute update
```

Return to current releases with `git switch main`, then run the normal two
update commands again.
