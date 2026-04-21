# GitHub Desktop Guide

## First upload of RogueRoute GPX

### If the repo already exists on GitHub
1. Open GitHub Desktop.
2. Go to **File -> Clone repository**.
3. Choose the **URL** tab.
4. Enter the repository URL:
   `https://github.com/RogueAssassin/RogueRoute-GPX.git`
5. Choose a local folder and click **Clone**.
6. Copy the updated project files into the cloned folder.
7. In GitHub Desktop, review the changed files.
8. Enter a commit summary such as `Release v7.0.0`.
9. Click **Commit to main**.
10. Click **Push origin**.

### If you already have the folder locally
1. Open GitHub Desktop.
2. Go to **File -> Add Local Repository**.
3. Choose your `RogueRoute-GPX` folder.
4. If the folder is not yet published, use **Publish repository**.
5. After editing files, review changes, commit, and click **Push origin**.

## Recommended workflow for releases
1. Update files locally.
2. Review changed files in GitHub Desktop.
3. Commit with a clear summary such as `Release v7.0.0`.
4. Push to GitHub.
5. Open GitHub in the browser and create a new release tag such as `v7.0.0`.
6. Upload the release ZIP and the `.user.js` plugin as release assets.

## Good commit examples
- `Release v7.0.0`
- `Update Docker and Valhalla guides`
- `Bump IITC plugin to v7.0.0`
- `Add refresh scripts and GitHub Desktop guide`

## What not to commit
Do not commit:
- `infra/docker/.env`
- `node_modules`
- `.next`
- generated logs
- private credentials
- downloaded Valhalla map data

Keep Valhalla map data outside the repo, for example in `/mnt/h/Valhalla`.
