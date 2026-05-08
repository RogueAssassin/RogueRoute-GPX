# Rev 10.3 TypeScript 6 + OSRM Path Fix

## Fixed

- Removed deprecated `baseUrl` from `tsconfig.base.json` for TypeScript 6 compatibility.
- Removed workspace `paths` mapping that pointed app builds directly at `packages/gpx-core/src`.
  - This prevents app/package builds from accidentally compiling files outside their own source root.
  - Workspace packages now resolve `@rogue/gpx-core` through pnpm workspace linking after `@rogue/gpx-core` builds.
- Added explicit `rootDir: "src"` to emit-producing TypeScript packages:
  - `packages/gpx-core`
  - `apps/gpx-console`
  - `apps/gpx-exporter`
- Added explicit `types: ["node"]` to the Next.js app config for TS6 Node API route globals.
- Kept `typescript@^6.0.3`, `pnpm@10.33.4`, and Node.js `24.15.0` targets.

## Why

TypeScript 6 deprecates `baseUrl` and changes `rootDir` defaults. The previous config worked under older TypeScript versions but fails under TS6 during `pnpm build`.

## Recommended clean rebuild

```bash
cd /opt/media-server/RogueRoute-GPX
rm -rf node_modules apps/*/node_modules packages/*/node_modules
corepack enable
corepack prepare pnpm@10.33.4 --activate
pnpm install
pnpm build
```

For service restart:

```bash
./stop.sh
./clean-web.sh
./restart.sh osrm
```
