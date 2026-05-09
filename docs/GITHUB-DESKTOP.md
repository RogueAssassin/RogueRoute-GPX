# GitHub Desktop publishing checklist

Before publishing:

1. Confirm `infra/docker/.env` is not staged.
2. Confirm no `.osm.pbf`, `.osrm*`, backup folders, zip files, or logs are staged.
3. Run `bash -n infra/scripts/*.sh *.sh scripts/*.sh`.
4. Run `./version-check.sh` if this is an update release.
5. Commit with a clear summary such as `Release v10.13.0 public cleanup`.
6. Push to GitHub.
7. Create a GitHub release tag such as `v10.13.0`.
8. Attach the generated release zip if you want a downloadable archive.

Recommended public release asset name:

```text
RogueRoute-GPX-v10.13.0.zip
```
