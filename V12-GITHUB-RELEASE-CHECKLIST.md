# v12 GitHub release checklist

1. Upload the contents of the v12 source ZIP to the repository and commit them
   to the default branch.
2. Confirm the `Publish RogueRoute GPX container` workflow is visible under
   GitHub Actions.
3. Create a GitHub Release with tag `v12` and use `docs/releases/v12.md` as the
   release notes.
4. Wait for the GHCR workflow to publish
   `ghcr.io/rogueassassin/rogueroute-gpx:v12`.
5. Make the package public, or authenticate the server with a token restricted
   to `read:packages`.
6. Copy the standalone ZIP to the server and follow
   `docs/V12-UPGRADE-GUIDE.md`.

Do not migrate the server before the `v12` image is available: the standalone
Compose file intentionally pulls that immutable tag.
