# Changelog

## v12.1.0 — Docker-first release

- Replaced the legacy host-build, nested Compose, sparse-checkout, and
  media-network deployment scripts with one standalone Compose project.
- Rebuilt installation and operations documentation around the GHCR image.
- Corrected release automation so either a pushed `v12.1.0` tag or a published
  GitHub Release produces semver container tags.
- Added release validation that requires `VERSION`, every workspace package,
  and the Git tag to agree before an image can be published.
- Retained the OSM download recovery, current OSRM MLD graph checks, adaptive
  5,000 m snapping, interactive route map, and compact GPX improvements.
- Removed the Docker socket mount and Docker CLI from the web container.

Earlier releases used a different source-build deployment model and are not
supported by the v12.1.0 installation guide.
