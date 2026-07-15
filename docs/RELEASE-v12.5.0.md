# RogueRoute GPX v12.5.0

v12.5.0 makes a complete regional map library manageable from the supported
CLI. `osm download-missing` discovers every catalog entry without a completed
PBF, resumes partial downloads, skips existing files, validates Geofabrik MD5
checksums when available and reports all failures after completing the batch.

`osm prepare-downloaded` finds downloaded regions without complete OSRM MLD
graphs and processes them sequentially. Completed graphs and source PBFs are
preserved, individual failures do not prevent later regions being attempted,
and only verified graphs become available to the website switcher.

Both potentially large batch operations require interactive confirmation or an
explicit `--yes`. This is intentional: downloading and expanding the entire
catalog can consume substantial storage, memory and processing time.

The release adds `sudo ./rogueroute permissions` as a one-time ownership repair
for migrated installations. Normal `git pull`, update, download, preparation
and container commands remain unprivileged after install or repair.

The release automation now preserves historical release-note files when
advancing versions. All workspace, Compose, image, web, IITC and documentation
surfaces are synchronized to v12.5.0.
