# RogueRoute GPX v12.6.1

RogueRoute GPX v12.6.1 is a container hardening release for Docker and rootless Podman.
It needs no configuration changes and no map data changes.

## Highlights

- The public web service runs as an unprivileged user with a read-only root filesystem,
  no Linux capabilities and `no-new-privileges`.
- The manager token is handed to the web user by `secrets-init`, which reports healthy only
  once that is done.
- The manager handles `SIGTERM`, and `secrets-init` stops immediately, so `stop`, `restart`
  and `update` no longer wait for the engine's kill timeout.
- `ROGUEROUTE_RUNTIME=auto` selects an engine that is running rather than merely installed:
  Podman first, or Docker first when the script runs as root.
- `HOST_BIND` limits the published web port to one address, for example `127.0.0.1` behind
  a reverse proxy.
- `rogueroute`, `install.sh` and `scripts/*.sh` are executable in Git, and scripts, YAML and
  the Dockerfile keep LF line endings on Windows checkouts.
- Pull requests build the image and smoke test the web service under the hardened runtime.
- Stable GHCR tags `12.6.1`, `12.6`, `12`, and `latest`.

## Upgrading

```bash
cd /opt/media-server/RogueRoute-GPX && git pull --ff-only
./rogueroute update
```

If `git pull` reports local changes to `rogueroute`, `install.sh` or `scripts/`, the checkout
only differs by the executable bit. Run `git checkout -- rogueroute install.sh scripts/` and
pull again.
