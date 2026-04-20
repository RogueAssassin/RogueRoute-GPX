# Troubleshooting

## `corepack: command not found`
```bash
sudo npm install -g corepack
sudo corepack enable
corepack prepare pnpm@10.12.1 --activate
```

or:
```bash
sudo npm install -g pnpm@10.12.1
```

## Compose file not found
```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

## Full 9080 runtime
- host: 9080
- container: 9080
- app: 9080
