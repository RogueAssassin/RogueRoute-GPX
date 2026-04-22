# RogueRoute GPX (Standard) Installation

## What Standard gives you
RogueRoute-GPX (Standard) is the base install for first-time users. It gives you the web UI, GPX generation workflow, IITC export support, and the simplest maintenance path.

## Prerequisites
- Docker with `docker compose`
- Node.js `22` for local install/build tasks
- enough free disk space for the app and container images

## First-time setup
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
bash first-run.sh
nano infra/docker/.env
./deploy.sh
```

Open:
```text
http://SERVER-IP:9080
```

## After a reboot or crash
Use restart commands instead of deploy commands when you are only bringing the same version back online.

```bash
cd /opt/media-server/RogueRoute-GPX
./restart.sh
./status.sh
./logs.sh
```

## Updating the app
When you actually want newer code:

```bash
./update.sh
./deploy.sh
```

For a full refresh that resets the repo to `origin/main` while preserving `infra/docker/.env`:

```bash
./refresh.sh
```

## Quick checks
```bash
./doctor.sh
curl -v http://127.0.0.1:9080/api/health
```
