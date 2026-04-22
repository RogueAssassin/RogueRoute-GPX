# Docker Deployment

## RogueRoute-GPX (Standard)
```bash
cd /opt/media-server/RogueRoute-GPX
./deploy.sh
```

## RogueRoute-GPX (Valhalla Enhanced)
```bash
cd /opt/media-server/RogueRoute-GPX
./deploy-valhalla.sh
```

## Restart after a reboot or crash
### Standard
```bash
./restart.sh
```

### Valhalla Enhanced
```bash
./verify-valhalla.sh
./restart-valhalla.sh
```

## Repair Valhalla and redeploy
```bash
cd /opt/media-server/RogueRoute-GPX
./repair-valhalla.sh
./deploy-valhalla.sh
```
