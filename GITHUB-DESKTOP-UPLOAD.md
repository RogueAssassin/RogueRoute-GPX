# Upload v12.5.1 with GitHub Desktop

Apply this package to the existing v12.4.0 Git checkout. Keep its hidden `.git`
directory and local ignored `.env` file.

1. In GitHub Desktop, fetch and pull the `main` branch.
2. Extract `RogueRoute-GPX-v12.5.1-source.zip` outside the checkout.
3. Copy its contents over the existing checkout, without deleting `.git` or
   `.env`.
4. Return to GitHub Desktop and review every changed file.
5. Commit with the summary `RogueRoute GPX v12.5.1 map automation` and push
   `main`.
6. On GitHub, create a new Release with the exact tag `v12.5.1` targeting that
   commit. Use `docs/RELEASE-v12.5.1.md` for the release notes.
8. The `Build and publish container` workflow will validate the project and
   publish GHCR tags `12.5.1`, `12.5`, `12`, and `latest`.

Do not name only the commit `v12.5.1`; a commit title is not a Git tag. The
workflow starts when the exact `v12.5.1` tag is pushed or when a GitHub Release
with that exact tag is published.
