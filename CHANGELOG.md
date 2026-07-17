# Changelog

## v12.5.1 — Reliable container health

- Added a native OSRM health check and made Web startup depend on healthy OSRM and Manager services.
- Added an OSRM readiness endpoint at `/api/health/osrm` for Rogue Dashboard and operational probes.
- Made `start`, `restart` and `update` wait for all long-running services to become healthy and print useful failure diagnostics.
- Made region switching wait for the replacement OSRM container and automatically recreate the previous graph when a switch fails.
- Updated new-install defaults to the official pinned OSRM v26.7.3 GHCR image, documented graph-format migration, and limited its optional host port to loopback.
- Added bounded Docker log rotation and Rogue Dashboard discovery labels to every long-running service.
- Updated GitHub Actions, added pull-request CI and Dependabot coverage, and expanded installation and troubleshooting documentation.

## v12.5.0 — Complete map-library automation

- Added confirmed `osm download-missing` batch downloads across the full region
  catalog, with resume, completed-file skipping and final failure summaries.
- Added `osm prepare-downloaded` to turn every downloaded incomplete extract
  into a validated, website-switchable MLD graph.
- Prevented corrupt checksum partials from entering an endless resume loop by
  preserving them separately and restarting cleanly on the next attempt.
- Added a one-time `sudo ./rogueroute permissions` repair while keeping normal
  Git, Docker and OSM operation unprivileged.
- Fixed version tooling so new release notes no longer replace the previous
  release's historical notes.

## v12.4.0 deployment update

- Production installs now remain Git checkouts, allowing updates with
  `git pull --ff-only` followed by `./rogueroute update`.
- `./rogueroute update` reads the repository `VERSION`, synchronizes the local
  ignored `.env`, and pulls the matching GHCR image automatically.
- The installer configures a clone in place and ensures the administrator owns
  it, while preserving external OSRM data and existing local secrets.

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
