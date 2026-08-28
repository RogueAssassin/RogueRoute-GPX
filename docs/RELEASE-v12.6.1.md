# RogueRoute GPX v12.6.1 Testing

RogueRoute GPX v12.6.1 is the active testing channel following the stable v12.6.0 Docker and Podman release.

## Testing baseline

- Docker Compose and rootless Podman Compose support.
- Shared `media-net` RogueDashboard integration.
- OSRM `v26.7.3-debian` default image and compatible graph preparation.
- Podman-compatible secret initialization and dependency handling.
- Runtime-neutral OSM preparation, health inspection, diagnostics, and region switching.
- Node 26.8.1, pnpm 11.24.0, and TypeScript 6.0.3 build toolchain.
- Testing images publish as `:testing` and `:12.6.1-testing`.

This version remains on the testing branch until regression testing is complete.
