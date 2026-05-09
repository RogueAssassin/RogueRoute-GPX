# RogueRoute-GPX Dependencies

Supported stack:

- Node.js `24.15.0` exactly for host-side builds
- Docker web image `node:24.15.0-alpine`
- pnpm `11.0.8`
- Docker Engine + Docker Compose
- OSRM backend Docker image
- curl or wget for `.osm.pbf` downloads
- bash, sed, awk, find, coreutils

The web app relies on:

- Next.js
- React / React DOM
- TypeScript
- internal `@rogue/gpx-core` workspace package
- OSRM HTTP API for road/path-following GPX generation
- optional map tile API key for display only, not routing
