# Upgrading

The installation is a Git checkout. Settings stay in the ignored `.env`; maps stay in
`OSRM_DATA_DIR`.

## Normal update

```bash
cd /opt/media-server/rogueroute-gpx
./rogueroute-gpx update
```

`update` fast-forwards the checkout to the latest commit of your channel's branch (`main` for
stable, `testing` for testing), applies `VERSION`, tidies `.env`, pulls that exact image and
recreates the container. Wait for the publish workflow for that version to finish first.
It stops without changing anything if tracked files in the checkout were edited.
`--no-fetch` skips the Git step and uses what is checked out.

## Your .env

On `start`, `restart` and `update` the script rewrites `.env` in the layout of `.env.example`:
section headings and comments, your values kept, and settings that no longer do anything
removed (the v12 manager settings and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`). Settings the
template does not know are kept under "Your additional settings". The previous file is saved
as `.env.backup-<time>` (the last five are kept).

## From v13.1 to v13.2

A normal `./rogueroute-gpx update`. Nothing in `.env` or the map data changes.

## From v13.0 to v13.1

A normal update. Map download and preparation now run in a background queue:

- Regions already downloaded but not prepared are queued automatically on the first start
  (set `ROGUEROUTE_AUTO_PREPARE=false` in `.env` first if you do not want that).
- `osm download` and `osm prepare` return straight away; add `--wait` to block as before.
  `osm job` is now `osm follow`.
- The website region panel no longer has Map administration; it moved to `/maps`.
- A v13.0 job still running when you update stops. Its region is still downloaded, so
  automatic preparation queues it again on start. From v13.1 on, queued work resumes by itself.

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

**Within v13**, check out the commit you want and apply it without fetching (a plain `update`
would fast-forward straight back to the latest commit):

```bash
git log --oneline -n 10 origin/main        # pick a commit, for example the previous merge
git checkout COMMIT
./rogueroute-gpx update --no-fetch
```

Return to the latest release with `./rogueroute-gpx update stable`.

**To v12**, stop the v13 container, check out the previous release and update. Going back to v12
recreates the v12 containers (rename the checkout back to `RogueRoute-GPX` first if you moved
it and your v12 `.env` or scripts refer to that path):

```bash
./rogueroute-gpx stop
git checkout 50b3682   # v12.6.3 on main
./rogueroute update
```

## Switching channel

The `testing` branch publishes `VERSION-testing` images (for example `13.2.0-testing`) and is
where changes are tried before they reach `main`. One command switches the checkout, the
channel in `.env` and the image tag together:

```bash
./rogueroute-gpx update testing    # testing branch and images
./rogueroute-gpx update stable     # back to main and stable releases
```

After that, a plain `./rogueroute-gpx update` stays on the chosen channel.

Installs from before v13.1 do not have this yet. Switch the checkout by hand once:

```bash
git fetch origin && git checkout main && git pull --ff-only
./rogueroute-gpx update stable
```
