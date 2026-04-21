# Installation

## Quick install
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
cp infra/docker/.env.example infra/docker/.env
./install.sh
./deploy.sh
```

Open the app on port `9080`.

## Recommended
Use `ROUTER_MODE=valhalla` for strict land routing.

## With Valhalla enabled
```bash
cd /opt/media-server/RogueRoute-GPX
cp infra/docker/.env.example infra/docker/.env  # first time only
./install.sh
./deploy-valhalla.sh
```
