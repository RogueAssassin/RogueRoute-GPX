# Docker Deployment

V10 uses the base web compose file plus the OSRM overlay.

```bash
cd infra/docker
docker compose -f docker-compose.yml -f docker-compose.osrm.yml up -d --build
```

The wrapper keeps this simpler:

```bash
./deploy.sh osrm
```

Stop everything:

```bash
./stop.sh
```
