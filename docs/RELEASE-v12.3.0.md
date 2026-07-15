# RogueRoute GPX v12.3.0

v12.3.0 adds managed OSRM region switching from the website while keeping
Docker access out of the public web container.

The release replaces the accumulated host-build and media-stack scripts with a
small standalone deployment: `compose.yaml`, `install.sh`, `rogueroute`, and the
Docker-based OSM helper. The server pulls the web image from GHCR and runs OSRM
against its external map-data folder.

Release publishing now validates that the Git tag, `VERSION`, all workspace
packages, Compose defaults, documentation badge, health endpoint and IITC
plugin agree. Pushing the tag or publishing the GitHub Release tagged
`v12.3.0` produces the container tags `12.3.0`, `12.3`, `12`, `latest`, and an
immutable SHA tag.

This release also includes the compact GPX geometry modes, 1,000-point default
budget, interactive map preview, 5,000 m strict-routing snap cap, and corrected
OSM/OSRM completion checks developed for v12.

Future releases can be prepared with `pnpm version:set X.Y.Z` and verified with
`pnpm version:check`, preventing a new image from retaining an older visible
version.

The internal manager is authenticated with an installation-generated token,
has no published port, validates prepared graphs through a read-only data mount,
updates the deployment environment and recreates only OSRM. It restores the
previous environment when Docker cannot apply a switch.

The CLI now includes container diagnostics plus region listing, status, path,
resumable batch downloads, MLD preparation, verification and OSRM-only
switching.
