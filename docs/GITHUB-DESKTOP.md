# GitHub Desktop Guide

## Easiest upload flow
### 1. Clone the repo in GitHub Desktop
- Open GitHub Desktop.
- Click **File -> Clone repository**.
- Use the **URL** tab.
- Enter your repo URL.
- Choose a local folder and click **Clone**.

### 2. Copy in the new release files
- Extract the RogueRoute GPX release zip.
- Copy the files into the cloned repository folder.
- Let Windows replace the older files.

### 3. Review the changed files
- Open GitHub Desktop.
- Review the changed files list.
- Make sure files like `infra/docker/.env` are not included.

### 4. Commit
Use a simple message like:
- `Release v7.0.1`
- `Improve beginner setup and Valhalla docs`

Then click **Commit to main**.

### 5. Push
Click **Push origin**.

## If you already have the repo on your PC
- Open GitHub Desktop.
- Click **File -> Add Local Repository**.
- Select your `RogueRoute-GPX` folder.

## What not to commit
Do not commit:
- `infra/docker/.env`
- `node_modules`
- `.next`
- build logs
- private credentials
- downloaded Valhalla map data
- big zip files you only use locally

## Release asset suggestion
For GitHub Releases, upload:
- the project zip
- the `.user.js` plugin file
- screenshots if you have them
