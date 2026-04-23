# Docker Deployment

This page is the quick command reference. For step-by-step setup, use:

- `docs/GUIDE-STANDARD-BEGINNER.md`
- `docs/GUIDE-VALHALLA-INTERMEDIATE.md`

## Standard mode deploy
```bash
cd /opt/media-server/RogueRoute-GPX
./deploy.sh
```

## Valhalla mode deploy
```bash
cd /opt/media-server/RogueRoute-GPX
./deploy-valhalla.sh
```

## Restart after reboot or crash
### Standard
```bash
./restart.sh
```

### Valhalla
```bash
./verify-valhalla.sh
./restart-valhalla.sh
```

## Notes
- The deploy scripts automatically create the `media-net` Docker network if needed.
- `HOST_PORT` is read from `infra/docker/.env`.
- Git pull is skipped automatically when running from a release ZIP instead of a Git checkout.
