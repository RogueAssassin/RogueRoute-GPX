# GitHub Desktop Guide

## Publishing the official RogueRoute GPX v8 release
1. Open GitHub Desktop.
2. Add or clone the `RogueRoute-GPX` repository.
3. Copy the updated release files into the repo.
4. Review the changed files.
5. Enter a summary such as `Release v8`.
6. Commit to `main`.
7. Push origin.
8. In GitHub, create a new release tagged `v8`.
9. Upload the release ZIP and the IITC userscript as release assets.

## Recommended release assets
- `RogueRoute-GPX-v8.zip`
- `gpx-route-generator.user.js`
- optional notes or screenshots for first-time users

## Before publishing
- confirm `apps/gpx-web` shows `v8` in the UI
- confirm `README.md` links to the split guide structure
- commit `pnpm-lock.yaml` after generating it on the supported toolchain
