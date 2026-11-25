# Changelog

## v13.5.0 — Admin page, map requests and map updates

- New `/admin` page with a password login (`ADMIN_PASSWORD`) and tabs for map requests, the map queue, regions and adding regions. It replaces the admin token and the Map administration section of `/maps`, which is now read-only. An existing `ADMIN_TOKEN` value becomes `ADMIN_PASSWORD` on update.
- Logins use an HttpOnly, SameSite=Strict session cookie that lasts 12 hours (Secure behind HTTPS), with a limit of five wrong passwords a minute per address; changes from other sites are refused.
- Visitors can request a missing map from `/maps/download`, and the route builder offers to request the region that covers waypoints outside every prepared map. Requests are counted per region and kept in `OSRM_DATA_DIR/.rogueroute-gpx/requests.json`; admins approve (add and queue) or dismiss them.
- Map updates: the date of each downloaded region is compared with Geofabrik's every `ROGUEROUTE_UPDATE_CHECK_DAYS` (7). Regions older than `ROGUEROUTE_AUTO_UPDATE_DAYS` (30; 0 = report only) are updated automatically. An update prepares the new data next to the old files and swaps it in, reloading the region being served and falling back to the old files if the new graph fails.
- Delete a region's files (extract, partial downloads, graph, staged update) from `/admin` or `osm delete`; the region being served is refused.
- New CLI: `osm updates [--check]`, `osm update REGION|--all`, `osm delete REGION --yes [--remove]`, `osm requests`.
- Tabs across the top of every page: Route builder, Map status, Find a map, Admin. The Map region panel no longer lists every prepared region.

## v13.4.0 — Add any region: downloader page and region outlines

- New `/maps/download` page: browse every Geofabrik region (continents down to states and provinces) in a tree or by search, on a map that shows the region's outline, its clickable sub-regions and what is already prepared. Each region shows its download size, the memory it needs, whether a prepared region already covers it and whether it is too large for this server; admins can download, prepare or remove it there.
- `osm search TEXT` finds any Geofabrik region; `osm add` accepts Geofabrik ids such as `us/california` and adds them to the region list first.
- Added regions are kept in `OSRM_DATA_DIR/.rogueroute-gpx/regions.json` and behave like built-in ones (Map status, automatic selection, queue).
- Automatic region selection uses real Geofabrik outlines instead of rectangles, for built-in and added regions.
- The Geofabrik index is downloaded once a week and cached in the map folder.
- `/maps` links "Too large" regions to the downloader, so a smaller sub-region is one click away.

## v13.3.0 — Map preparation that cannot take the server down

- The container gets a memory cap (`ROGUEROUTE_MEMORY_LIMIT`, `auto` = 70% of host RAM) with no extra swap, so the kernel stops a map tool inside the container instead of the host running out of memory.
- Regions estimated to need more than 85% of the cap are refused by `osm add`, skipped by auto-prepare and `prepare-downloaded`, and marked "Too large for this server" on `/maps`. `--force` (or Prepare anyway) still tries them.
- A memory watchdog stops `osrm-extract`, `osrm-partition` or `osrm-customize` when free host memory falls below `ROGUEROUTE_MEMORY_FLOOR` or the container nears its cap, and records the reason.
- Map tools run at idle disk priority (`ROGUEROUTE_PREPARE_IDLE_IO`) and are the first thing the kernel stops if memory runs out.
- Memory estimates use 5x the extract size for the foot profile (was 2.5x) and the measured peak once a region has been prepared.
- `osm status`, `doctor` and `/maps` show the memory cap and each region's estimate.

## v13.2.0 — v13.1 fixes rolled up, documentation refresh

- Includes v13.1.1: `start`, `restart` and `update` clear the previous container and stale Podman pod before starting.
- Fixed a flaky map-queue unit test that could read `queue.json` before the queue finished saving.
- CI downloads its test maps from the openstreetmap.fr mirror, so Geofabrik refusing GitHub runners no longer fails the build.
- README: new Updating section with the stable and testing channels and their image tags, `ROGUEROUTE_CHANNEL` and `OSRM_PROFILE` in the configuration table, links to all release notes and the changelog, refreshed screenshots; OpenSSL is no longer listed as a requirement.
- Docs: rolling back within v13 (`update --no-fetch`), v13.1 to v13.2 upgrade note.

## v13.1.1 — Clear stale Podman pods on start

- `start`, `restart` and `update` remove the previous container, and on Podman the `pod_rogueroute-gpx` pod, after pulling and before starting. This fixes `Error: no pod with name or ID pod_rogueroute-gpx found` under podman-compose when a container outlived its pod. Map data, `.env` and the map queue are not affected.

## v13.1.0 — Background map queue and /maps

- Map download and preparation run in a persistent background queue: one region at a time, smallest first, at low CPU priority. It resumes after a restart or update, and downloaded-but-unprepared regions are queued automatically (`ROGUEROUTE_AUTO_PREPARE`).
- Failures are recorded with step and reason (out of memory is detected) and do not stop the rest; `osm retry` queues them again. Free disk space is checked before downloads and preparation, and a memory warning is logged when a region probably will not fit.
- New public `/maps` page: regions ready, in progress (step, download progress, speed and time) and waiting, refreshed live. Queue administration (add, remove, retry, cancel, pause, resume, log, disk and memory) moved there behind `ADMIN_TOKEN`.
- New CLI: `osm add`, `osm queue [pause|resume|cancel|clear|remove]`, `osm retry`, `osm follow`, `osm prepare-all`; `--wait` blocks until regions finish. `osm download`/`prepare` now queue and return.
- New settings: `ROGUEROUTE_AUTO_PREPARE`, `ROGUEROUTE_PREPARE_THREADS`, `ROGUEROUTE_PREPARE_NICE`.
- API: `/api/maps` (public) and `/api/admin/queue` replace `/api/admin/jobs`.
- `./rogueroute-gpx update [stable|testing]` fast-forwards the checkout to the channel's branch before applying it; naming a channel switches branch, `.env` channel and image tag in one step.
- `.env` is rewritten in the layout of the new sectioned, commented `.env.example` on start/update, keeping your values, dropping unused settings (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, v12 manager keys) and saving a backup.
- README screenshots of the route builder and the map status page.

## v13.0.0 — One container, automatic regions

- Rebuilt the runtime as a single `rogueroute-gpx` container: website, OSRM, region switching, and map download/preparation. The manager, secrets-init and separate OSRM containers, the engine socket mount and the secrets volume are gone.
- Region switching restarts `osrm-routed` inside the container under a supervisor, with rollback to the previous graph, so it behaves the same on Docker and Podman.
- Routes pick the prepared region containing all waypoints and switch automatically; the Map region panel can force a region and shows OSRM state.
- `osm` commands run inside the container; optional website map administration with `ADMIN_TOKEN`.
- One region catalog, `regions.json`, with areas for automatic selection.
- Lowercase `rogueroute-gpx` naming for the repository, install path, script, packages and IITC plugin. `./rogueroute` forwards to `./rogueroute-gpx`.
- `./rogueroute-gpx update` migrates v12 installs and keeps Rogue Dashboard compatibility.

## v12.6.3 — OSRM container handover

- Fixed website region switching failing with `the container name "rogueroute-gpx-osrm" is already in use` on Podman hosts: the manager now removes the current OSRM container before recreating it, because Docker Compose does not recognise a container created by `podman compose`.
- `./rogueroute start`, `restart` and `update` replace an OSRM container left by the region switcher, and `./rogueroute osm switch` frees the name before recreating OSRM.

## v12.6.2 — Podman region switching

- Fixed website region switching failing with `network rogueroute-gpx was found but has incorrect label com.docker.compose.network` on Podman hosts: the private `rogueroute-gpx` network is now external and pre-created by `install.sh` and `./rogueroute`, so Docker Compose in the manager accepts a network created by `podman compose`.

## v12.6.1 — Container hardening

- Ran the public web service as an unprivileged user with a read-only root filesystem, no capabilities and `no-new-privileges`.
- Made `secrets-init` hand the manager token to the web user and stop immediately; added `no-new-privileges` to every service.
- Added `SIGTERM` handling to the manager so stops and recreates no longer wait for the kill timeout.
- Made `ROGUEROUTE_RUNTIME=auto` select a running engine, Podman first, or Docker first when run as root.
- Added `HOST_BIND` to limit the published web port to one address.
- Marked the administration scripts executable in Git and pinned LF line endings for container files.
- Added a pull-request image build with web and manager smoke tests; an in-progress publish is never cancelled.

## v12.6.0 — Docker and Podman runtime support

- Added Docker and rootless Podman runtime support across install, operations, container health checks, and OSRM region switching.
- Added shared `media-net` connectivity for RogueDashboard while retaining RogueRoute's private internal network.
- Added isolated GHCR testing tags while promoting the proven runtime changes to stable `12.6.0` and `latest`.
- Updated the build toolchain to Node 26.8.1, pnpm 11.24.0, and Next.js-compatible TypeScript 6.0.3.
- Kept RogueRoute application versioning separate from the container channel through `ROGUEROUTE_TAG`.
- Updated deployment documentation, Podman socket handling, OSRM v26.7.3 Debian image defaults, shared-network health integration, and Podman-compatible dependency handling.


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
