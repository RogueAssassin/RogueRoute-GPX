# RogueRoute GPX v12.1.0

v12.1.0 is the corrected Docker-first release.

The release replaces the accumulated host-build and media-stack scripts with a
small standalone deployment: `compose.yaml`, `install.sh`, `rogueroute`, and the
Docker-based OSM helper. The server pulls the web image from GHCR and runs OSRM
against its external map-data folder.

Release publishing now validates that the Git tag, `VERSION`, and all workspace
package versions agree. Publishing the GitHub Release tagged `v12.1.0` produces
the container tags `12.1.0`, `12.1`, `12`, `latest`, and an immutable SHA tag.

This release also includes the compact GPX geometry modes, 1,000-point default
budget, interactive map preview, 5,000 m strict-routing snap cap, and corrected
OSM/OSRM completion checks developed for v12.
