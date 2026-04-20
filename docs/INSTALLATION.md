# Installation

```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/gpx-route-generator.git
cd gpx-route-generator
cp .env.example .env
bash infra/scripts/install.sh
bash infra/scripts/deploy.sh
```

Open the app on port `9080`.

## Recommended
Use `ROUTER_MODE=valhalla` for strict land routing.
