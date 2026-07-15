# Upgrading and rollback

The production image is pinned by `ROGUEROUTE_VERSION` in `.env`.

To upgrade to v12.4.0:

```bash
cd /opt/rogueroute-gpx
sed -i 's/^ROGUEROUTE_VERSION=.*/ROGUEROUTE_VERSION=12.4.0/' .env
./rogueroute update
```

The installer can replace an older source-build installation safely:

```bash
sudo ./install.sh --path /opt/media-server/RogueRoute-GPX \
  --data-dir /mnt/h/osrm \
  --region new-zealand
```

It stops only the Compose project at that path, moves the directory to a
timestamped backup, preserves `.env`, and leaves external map data untouched.

For rollback, stop the new project, move it aside, restore the timestamped
backup directory, and start the previous deployment. Do not delete the backup
until v12.4.0 has generated a known route successfully.
