# RogueRoute GPX v12.5.1

Version 12.5.1 makes container health accurate, startup deterministic and Rogue Dashboard integration self-diagnosing.

## Container health

- Web and Manager retain private HTTP liveness checks.
- OSRM now reports native Docker health only after `osrm-routed` is running and port 5000 is listening.
- Web waits for healthy OSRM and Manager dependencies.
- `./rogueroute start`, `restart` and `update` wait up to `ROGUEROUTE_STARTUP_TIMEOUT_SECONDS` for all services and print states plus recent logs on failure.
- `/api/health/osrm` executes a lightweight OSRM API request and returns HTTP 503 for transport or server failures.

## Safer operation

- Region switching waits for the replacement OSRM container. A failed switch restores `.env`, recreates the previous OSRM graph and verifies its health.
- Docker JSON logs rotate at three 10 MB files per service.
- New installations default to the official pinned `ghcr.io/project-osrm/osrm-backend:v26.7.3` image. Existing explicit image settings are preserved and the upgrading guide documents the required graph re-preparation.
- The optional OSRM host port now binds to `127.0.0.1`; inter-container traffic stays on `rogueroute-gpx`.

## Rogue Dashboard

Use Rogue Dashboard 1.0.1 or later. Its installer and upgrader auto-detect the `rogueroute-gpx` network when `RGDASH_EXTRA_NETWORK` is empty. The stable cards monitor Web through `/api/health` and OSRM through `/api/health/osrm`, with native Docker health as the authoritative fallback.

## Upgrade

```bash
cd /opt/media-server/RogueRoute-GPX
git pull --ff-only
./rogueroute update
./rogueroute doctor
```

Prepared map data and the existing manager secret volume are preserved.
