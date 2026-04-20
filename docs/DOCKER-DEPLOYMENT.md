# Docker Deployment

## Port model
```yaml
ports:
  - "9080:9080"
```

## Start
```bash
bash infra/scripts/deploy.sh
```

## Rebuild
```bash
docker compose -f infra/docker/docker-compose.yml up -d --build --force-recreate
```

## Stop
```bash
docker compose -f infra/docker/docker-compose.yml down
```

## Health check
```bash
curl http://localhost:9080/api/health
```
