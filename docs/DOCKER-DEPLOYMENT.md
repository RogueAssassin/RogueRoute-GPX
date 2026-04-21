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

## Wrapper commands
```bash
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
- The helper scripts warn when common ports appear busy and stop early if `infra/docker/.env` is missing.
