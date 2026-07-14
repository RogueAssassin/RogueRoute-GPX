# RogueRoute GPX v12 upgrade guide

## 1. Publish the image

Upload the v12 source package to GitHub, commit it, then create the `v12` tag or
GitHub Release. The `Publish RogueRoute GPX container` workflow publishes:

```text
ghcr.io/rogueassassin/rogueroute-gpx:v12
```

Wait for the workflow to finish before migrating the server.

## 2. Extract the standalone package outside the old installation

```bash
cd /tmp
unzip RogueRoute-GPX-v12-standalone-docker.zip
cd RogueRoute-GPX
```

## 3. Run the guarded migration

```bash
sudo ./install.sh --target /opt/media-server/RogueRoute-GPX
```

The installer stops only RogueRoute, verifies map data is not stored inside the
application directory, moves the old directory to a timestamped backup, copies
the standalone files, reuses the previous environment, and starts v12. It does
not change Rogue Dashboard or `/mnt/h/osrm`.

## 4. Verify

```bash
cd /opt/media-server/RogueRoute-GPX
./status.sh
./logs.sh gpx-web
```

Open `http://SERVER-IP:9080` and generate a known route. The status panel should
show v12, a route preview, and the GPX track-point count.

## Roll back

Stop v12, move its directory aside, and rename the timestamped
`RogueRoute-GPX-backup-*` directory back to `RogueRoute-GPX`. External OSRM data
does not need to be restored.
