# Upgrading

The installation is a Git checkout. Settings stay in the ignored `.env`; maps stay in
`OSRM_DATA_DIR`.

## Normal update

```bash
cd /opt/media-server/rogueroute-gpx && git pull --ff-only
./rogueroute-gpx update
```

`update` applies `VERSION` to `.env`, pulls that exact image and recreates the container.
Wait for the publish workflow for that version to finish first.

## From v12 to v13

v13 replaces the four v12 containers (`rogueroute-gpx-web`, `-manager`, `-osrm`,
`-secrets-init`) with one container, `rogueroute-gpx`. Prepared maps are reused as they are.

1. Rename the GitHub repository to `rogueroute-gpx` (GitHub redirects the old URL), and point
   the checkout at it:

   ```bash
   cd /opt/media-server/RogueRoute-GPX
   git remote set-url origin https://github.com/RogueAssassin/rogueroute-gpx.git
   git pull --ff-only
   ```

2. Apply v13:

   ```bash
   ./rogueroute-gpx update
   ```

   This removes the v12 containers and the `rogueroute-gpx-manager-secrets` volume, drops
   settings v13 no longer uses (`OSRM_MANAGER_*`, `OSRM_SWITCH_ENABLED`, `CONTAINER_SOCKET`,
   `OSRM_IMAGE`, `OSRM_HOST_PORT`, `OSRM_GRAPH`, `OSRM_PBF`), adds `PUID`/`PGID`, and starts
   the new container on your `OSRM_ACTIVE_REGION`.

3. Optional but recommended: move the checkout to the lowercase path.

   ```bash
   ./rogueroute-gpx stop
   sudo mv /opt/media-server/RogueRoute-GPX /opt/media-server/rogueroute-gpx
   cd /opt/media-server/rogueroute-gpx
   ./rogueroute-gpx start
   ```

4. Check:

   ```bash
   ./rogueroute-gpx doctor
   ```

If v12 files in the map folder were written by root, run `sudo ./rogueroute-gpx permissions`
once.

What changed for you:

- The script is `./rogueroute-gpx` (the old name forwards to it).
- Routes switch region automatically; the old Region Switcher is now the Map region panel.
- `osm` commands run inside the container; the host no longer needs curl or OSRM images.
- OSRM's port 5000 is internal only. Use `/api/health/osrm` for monitoring.
- The IITC plugin is now `/downloads/iitc/rogueroute-gpx.user.js`. The old
  `rogueroute-exporter.user.js` path still serves the same file for v12 installs' updates and
  will be removed in v14.

## Rolling back

Stop the v13 container, check out the previous release and update. Going back to v12
recreates the v12 containers (rename the checkout back to `RogueRoute-GPX` first if you moved
it and your v12 `.env` or scripts refer to that path):

```bash
./rogueroute-gpx stop
git checkout 50b3682   # v12.6.3 on main
./rogueroute update
```

## Testing channel

The `testing` branch publishes `VERSION-testing` images (for example `13.0.0-testing`). To
run a server on it, check out `testing` and set the channel before updating:

```bash
git fetch origin && git checkout testing && git pull --ff-only
sed -i 's/^ROGUEROUTE_CHANNEL=.*/ROGUEROUTE_CHANNEL=testing/' .env || true
grep -q '^ROGUEROUTE_CHANNEL=' .env || echo 'ROGUEROUTE_CHANNEL=testing' >> .env
./rogueroute-gpx update
```

Set `ROGUEROUTE_CHANNEL=stable` and check out `main` to return to stable releases.
