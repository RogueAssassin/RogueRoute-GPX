# Beginner Guide: Standard Mode

Use this guide if you want the easiest self-hosted setup.

## What this mode is for
Standard mode runs the RogueRoute GPX web app without Valhalla. It is the best choice for:
- first-time users
- home server users
- low-maintenance deployments
- people who do not want to manage map datasets

## Before you begin
Read `docs/SYSTEM-REQUIREMENTS.md` first.

You need:
- Docker
- `docker compose`
- Node.js 24.15.0
- Corepack 0.34.7
- pnpm 10.33.1
- port `9080` available

## Step 1: Get the release onto your server
### Option A: Git clone
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
```

### Option B: Release ZIP
Unzip the release, then enter the extracted folder.

```bash
cd /opt/media-server
unzip RogueRoute-GPX-v8.0.0.zip
cd RogueRoute-GPX
```

## Step 2: Fix script permissions
```bash
bash fix-permissions.sh
```

## Step 3: Run first-time setup
```bash
bash first-run.sh
```

When asked which mode to use, choose **Standard**.

This creates:
```text
infra/docker/.env
```
from:
```text
infra/docker/.env.standard
```

## Step 4: Review your environment file
Open `infra/docker/.env` and confirm:

```env
ROUTER_MODE=direct
HOST_PORT=9080
PORT=9080
```

If you want the app on another host port, change `HOST_PORT`.

## Step 5: Deploy the app
```bash
./deploy.sh
```

The script will:
- ensure Docker is available
- create `media-net` if it does not exist
- check Node.js and pnpm
- build the workspace
- start the web app container

## Step 6: Open the app
Open:

```text
http://SERVER-IP:9080
```

If you changed `HOST_PORT`, use that port instead.

## Restart after reboot or crash
Use restart commands when you are bringing the same version back online.

```bash
./restart.sh
./status.sh
./logs.sh
```

## Update guidance
### Git installs
```bash
./update.sh
./deploy.sh
```

### Release ZIP installs
Download the next release ZIP, replace the folder, copy your `infra/docker/.env` into the new release, then deploy again.

## Quick health checks
```bash
./doctor.sh
curl -v http://127.0.0.1:9080/api/health
```
