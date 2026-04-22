# Installation

## Beginner setup
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
bash first-run.sh
nano infra/docker/.env
./deploy.sh
```

## With Valhalla
```bash
./deploy-valhalla.sh
```

## If Valhalla gets stuck
```bash
./repair-valhalla.sh
./deploy-valhalla.sh
```
