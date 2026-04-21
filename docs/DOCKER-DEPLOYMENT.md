# Docker Deployment

## Standard web app
```bash
cd /opt/media-server/RogueRoute-GPX
cp infra/docker/.env.example infra/docker/.env  # first time only
./deploy.sh
```

## Web app with Valhalla
```bash
cd /opt/media-server/RogueRoute-GPX
cp infra/docker/.env.example infra/docker/.env  # first time only
./deploy-valhalla.sh
```

## Clean refresh after pulling new versions
Use this when you want to replace old repo files with the latest GitHub version without touching external Valhalla data:

```bash
cd /opt/media-server/RogueRoute-GPX
./refresh.sh
```

With Valhalla:
```bash
./refresh-valhalla.sh
```

These wrappers:
- stop the running stack
- fetch the latest changes
- hard reset to `origin/main`
- remove stale files that no longer belong in the repo
- preserve `infra/docker/.env`
- rebuild and redeploy

## Wrapper commands
```bash
./install.sh
./deploy.sh
./deploy-valhalla.sh
./refresh.sh
./refresh-valhalla.sh
./update.sh
./status.sh
./logs.sh
./logs-valhalla.sh
./stop.sh
```

## Direct compose commands
```bash
cd /opt/media-server/RogueRoute-GPX/infra/docker
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.valhalla.yml down
```

## Health checks
```bash
curl http://localhost:9080/api/health
curl http://localhost:8002/status
```

## Notes
- `docker-compose.valhalla.yml` is an override file and should be combined with the base compose file.
- Valhalla expects map data in `/custom_files` inside the container.
- On WSL, a Windows `H:\Valhalla` folder typically maps to `/mnt/h/Valhalla`.
- The helper scripts stop early if `infra/docker/.env` is missing.
- The refresh scripts keep `infra/docker/.env` in place while removing stale repo files.
