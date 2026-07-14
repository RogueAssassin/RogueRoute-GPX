# Upload v12.1.0 with GitHub Desktop

This release intentionally deletes the old scripts and guides. Copying the new
files over an existing clone is not enough because it would leave those old
files behind.

1. In GitHub Desktop, fetch and pull the `main` branch.
2. Open the repository in your file manager.
3. Keep the hidden `.git` directory, but remove every other file and directory
   from the working tree.
4. Copy the contents of the extracted `RogueRoute-GPX-v12.1.0-source` directory
   into the now-empty working tree.
5. Return to GitHub Desktop. Confirm it shows the old scripts as deleted and
   the new Docker files as added.
6. Commit with the summary `RogueRoute GPX v12.1.0 Docker release` and push
   `main`.
7. On GitHub, create a new Release with the exact tag `v12.1.0` targeting that
   commit. Use `docs/RELEASE-v12.1.0.md` for the release notes.
8. The `Build and publish container` workflow will validate the project and
   publish GHCR tags `12.1.0`, `12.1`, `12`, and `latest`.

Do not name only the commit `v12.1.0`; the workflow starts when the GitHub
Release with that exact tag is published.
