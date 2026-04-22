# Docker Deployment

## Web app only
```bash
cd /opt/media-server/RogueRoute-GPX
./deploy.sh
```

## Web app with Valhalla
```bash
cd /opt/media-server/RogueRoute-GPX
./deploy-valhalla.sh
```

## Repair Valhalla and redeploy
```bash
cd /opt/media-server/RogueRoute-GPX
./repair-valhalla.sh
./deploy-valhalla.sh
```
