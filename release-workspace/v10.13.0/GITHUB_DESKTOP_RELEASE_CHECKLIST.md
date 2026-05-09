# GitHub Desktop Release Checklist — v10.13.0

1. Open GitHub Desktop.
2. Choose the RogueRoute-GPX repository.
3. Review all changed files.
4. Commit summary:

```text
Release v10.13.0 OSRM snap recovery and IITC install support
```

5. Commit description:

```text
- Add OSRM nearest-path auto-snap retry for NoSegment failures
- Add route caching and parallel OSRM leg processing
- Update pnpm pin to 11.0.8
- Add Tampermonkey install and direct IITC plugin download
- Refresh release notes and environment defaults
```

6. Push to GitHub.
7. In GitHub Desktop, create tag:

```text
v10.13.0
```

8. Push the tag.
9. On GitHub, open Releases > Draft a new release.
10. Select tag `v10.13.0`.
11. Use the contents of `release-workspace/v10.13.0/RELEASE_NOTES.md` as the changelog.
12. Attach the final zip file.
13. Publish release.
