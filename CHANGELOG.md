# Changelog

## v12.4.0 — Container-only manager secrets

- Removed the browser-facing website switch key.
- Moved web-to-manager authentication out of `.env` and into a private Docker
  named volume mounted read-only by both containers.
- Added a one-shot secret initializer, global switch lock, same-region no-op and
  configurable restart cooldown for safe public switching.
- Removed legacy manager/access secrets from existing environment files during
  install and startup.

## v12.3.1 — Direct-runtime startup fix

- Fixed `./rogueroute start` from an extracted server package by generating the
  required runtime keys when `.env` is first created.
- Kept `install.sh` generation for normal `/opt/media-server` installations.
- Added clear output when the website access key is generated.

## v12.3.0 — Managed website region switching

- Added an authenticated internal manager sidecar with no published port.
- Enabled website switching without mounting Docker into the public web
  container.
- Added prepared-graph validation, OSRM-only recreation, concurrency protection
  and environment rollback when a switch fails.
- Expanded the CLI with help, map status, configured path, verification,
  diagnostics, safe configuration output and service-specific logs.
- Rebuilt the OSM and command documentation around `OSRM_DATA_DIR`.

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
- Corrected release automation so either a pushed `v12.1.0` tag or a published
  GitHub Release produces semver container tags.
- Added release validation that requires `VERSION`, every workspace package,
  and the Git tag to agree before an image can be published.
- Retained the OSM download recovery, current OSRM MLD graph checks, adaptive
  5,000 m snapping, interactive route map, and compact GPX improvements.
- Removed the Docker socket mount and Docker CLI from the web container.

Earlier releases used a different source-build deployment model and are not
supported by the current installation guide.
