# RogueRoute GPX v12.6.0

RogueRoute GPX v12.6.0 introduces the Docker and Podman compatible testing runtime.

## Highlights

- Docker Compose and rootless Podman Compose support.
- Shared `media-net` connectivity for RogueDashboard health monitoring.
- Private RogueRoute network retained for internal service traffic.
- Testing images published as `ghcr.io/rogueassassin/rogueroute-gpx:testing` and `ghcr.io/rogueassassin/rogueroute-gpx:12.6.0-testing`.
- Node 26.8.1 and pnpm 11.24.0 testing toolchain.
- TypeScript kept on the latest Next.js 16.2-compatible 6.x line for production builds.
- Runtime socket selection through `CONTAINER_SOCKET` and `ROGUEROUTE_RUNTIME`.

This release remains in the testing channel until Docker and Podman validation is complete.
