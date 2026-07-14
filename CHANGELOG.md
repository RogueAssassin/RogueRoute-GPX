# Changelog

## v12.2.0 — Automated release consistency

- Added a single version command that updates and validates the workspace,
  container defaults, documentation, release badge, health fallback and IITC
  plugin together.
- Made GHCR publishing run from either an actual `v12.2.0` tag push or a
  published GitHub Release.
- Added a release gate that prevents images from publishing when any version
  surface disagrees with `VERSION`.
- Added the redesigned RogueRoute hero and Docker-first README presentation.

## v12.1.0 — Docker-first release

- Replaced the legacy host-build, nested Compose, sparse-checkout, and
  media-network deployment scripts with one standalone Compose project.
- Rebuilt installation and operations documentation around the GHCR image.
- Corrected release automation so either a pushed `v12.2.0` tag or a published
  GitHub Release produces semver container tags.
- Added release validation that requires `VERSION`, every workspace package,
  and the Git tag to agree before an image can be published.
- Retained the OSM download recovery, current OSRM MLD graph checks, adaptive
  5,000 m snapping, interactive route map, and compact GPX improvements.
- Removed the Docker socket mount and Docker CLI from the web container.

Earlier releases used a different source-build deployment model and are not
supported by the v12.2.0 installation guide.
