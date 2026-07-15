# OSM downloads, preparation and switching

RogueRoute stores every download and prepared graph under the configured
`OSRM_DATA_DIR`. Confirm the active location before a large operation:

```bash
./rogueroute osm path
./rogueroute osm status
```

## Download

```bash
./rogueroute osm list
./rogueroute osm download new-zealand
./rogueroute osm download australia new-zealand japan
./rogueroute osm download-missing
./rogueroute osm download-missing --yes
```

Downloads come from Geofabrik, retry transient failures and resume an existing
`.part` file. Available checksums are verified before a download receives its
final `.osm.pbf` name. A batch attempts every region and summarizes failures.
Completed PBFs are skipped. If a checksum fails, the invalid partial is retained
with a timestamp and the next run starts that region cleanly rather than
repeatedly resuming corrupt data.

`download-missing` includes every missing or partial entry in the built-in
catalog. Without `--yes`, it displays the region list and asks for confirmation.
Use `--yes` only after checking available storage with `df -h /mnt/h/osrm`; the
complete catalog can require tens of gigabytes just for PBFs.

## Prepare

```bash
./rogueroute osm prepare new-zealand
./rogueroute osm prepare-downloaded
./rogueroute osm prepare-downloaded --yes
```

Preparation mounts `OSRM_DATA_DIR` into the configured OSRM image and runs:

1. `osrm-extract -p /opt/foot.lua`
2. `osrm-partition`
3. `osrm-customize`

The command selects the region only after `.osrm.mldgr`, `.osrm.partition` and
`.osrm.cell_metrics` exist and are non-empty. Country extracts are strongly
recommended because preparation can need much more space than the original PBF.
The batch command skips complete graphs, processes all downloaded incomplete
regions sequentially, preserves source PBFs, continues after failures and
prints a summary. It does not automatically change the active region.

## Permissions

The installer assigns the Git checkout and `OSRM_DATA_DIR` to the administrator
who ran it through `sudo`, so normal RogueRoute and Git commands run without
`sudo`. If files were copied as root or storage ownership changes, repair them
once:

```bash
cd /opt/media-server/RogueRoute-GPX
sudo ./rogueroute permissions
```

Do not run every download with `sudo`; doing so creates root-owned map files and
causes later unattended updates to fail.

## Verify and switch from the server

```bash
./rogueroute osm verify new-zealand
./rogueroute osm switch new-zealand
```

The CLI switch updates `.env` and recreates only the OSRM container.

## Switch from the website

The website sends an allowlisted region to the internal manager. The manager
authenticates the request, checks the prepared MLD files through its read-only
data mount, updates `.env`, and recreates only OSRM. If Docker fails, the
previous environment is restored.

The switcher reports **Manager: Ready** when the sidecar is healthy. Prepare a
region from the CLI before selecting it on the website.

```dotenv
OSRM_SWITCH_ENABLED=true
OSRM_MANAGER_URL=http://manager:9090
OSRM_MANAGER_TOKEN_FILE=/run/rogueroute-secrets/manager-token
OSRM_SWITCH_COOLDOWN_SECONDS=60
```

Docker creates the token inside a private named volume and mounts the file
read-only into the web and manager services. It is never returned to the
browser. Never publish port 9090 through the host or a reverse proxy.

Region selection is global because one OSRM container serves all visitors. A
switch briefly changes routing for everyone, so the manager serializes requests
and enforces the configured cooldown.
