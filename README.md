# RogueRoute GPX v6

Cyber neon wolf edition of the GPX generator by RogueAssassin.

## Highlights
- redesigned v6 web UI
- strict land routing toggle
- explicit manual override warnings
- ferry toggle
- named GPX and debug downloads
- IITC exporter with prompted route names
- RogueAssassin branding and repo links
- Docker-ready Next.js deployment on port 9080

## Repo
`https://github.com/RogueAssassin/gpx-route-generator`

## Quick start
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/gpx-route-generator.git
cd gpx-route-generator
cp .env.example .env
bash infra/scripts/install.sh
bash infra/scripts/deploy.sh
```

Open:
```text
http://SERVER-IP:9080
```

## Recommended runtime
For strict land routing, run with Valhalla enabled:
```env
ROUTER_MODE=valhalla
VALHALLA_URL=http://valhalla:8002
```

If Valhalla cannot route a leg, v6 either:
- blocks the route when manual override is off
- marks the leg as a manual override when manual override is on

## IITC plugin
Website download path:
```text
/downloads/iitc/rogueroute-exporter.user.js
```

Source plugin file:
```text
plugins/iitc/gpx-route-generator.user.js
```
