# RogueRoute GPX v12.6.0

RogueRoute GPX v12.6.0 is the stable Docker and Podman compatibility release.

## Highlights

- Docker Compose and rootless Podman Compose support across install, start, update, diagnostics, OSM preparation, and region switching.
- Shared `media-net` connectivity for RogueDashboard health monitoring while retaining RogueRoute's private internal network.
- OSRM `v26.7.3-debian` as the verified multi-platform default image.
- Podman-compatible secret initialization and dependency handling.
- Runtime-neutral health and doctor checks.
- Node 26.8.1, pnpm 11.24.0, and TypeScript 6.0.3 build toolchain.
- Stable GHCR tags `12.6.0`, `12.6`, `12`, and `latest`.
- Testing remains isolated on `:testing` and version-specific `-testing` tags.

This release was validated on the testing channel before promotion to main.
