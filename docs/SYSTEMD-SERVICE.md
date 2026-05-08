# Systemd Service

Example service command for V9:

```ini
[Service]
WorkingDirectory=/opt/media-server/RogueRoute-GPX
ExecStart=/usr/bin/bash -lc './restart.sh'
Restart=always
```

Prepare OSRM data before enabling the service:

```bash
./prepare-osrm.sh
./deploy.sh osrm
```
