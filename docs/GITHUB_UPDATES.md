# GitHub Updates and Releases

Check latest GitHub release:

```bash
./version-check.sh
```

Update a git checkout:

```bash
sudo ./update.sh osrm
sudo ./deploy.sh osrm
```

Create a tag and push it:

```bash
./release.sh v10.0.0
```

For private repos or higher rate limits, export a token first:

```bash
export GITHUB_TOKEN=ghp_xxx
./version-check.sh
```
