# RogueRoute GPX v12.2.0

v12.2.0 is the Docker-first release with automatic version consistency.

The release replaces the accumulated host-build and media-stack scripts with a
small standalone deployment: `compose.yaml`, `install.sh`, `rogueroute`, and the
Docker-based OSM helper. The server pulls the web image from GHCR and runs OSRM
against its external map-data folder.

Release publishing now validates that the Git tag, `VERSION`, all workspace
packages, Compose defaults, documentation badge, health endpoint and IITC
plugin agree. Pushing the tag or publishing the GitHub Release tagged
`v12.2.0` produces
the container tags `12.2.0`, `12.2`, `12`, `latest`, and an immutable SHA tag.

This release also includes the compact GPX geometry modes, 1,000-point default
budget, interactive map preview, 5,000 m strict-routing snap cap, and corrected
OSM/OSRM completion checks developed for v12.

Future releases can be prepared with `pnpm version:set X.Y.Z` and verified with
`pnpm version:check`, preventing a new image from retaining an older visible
version.
