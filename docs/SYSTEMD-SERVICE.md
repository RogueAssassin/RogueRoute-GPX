# Systemd Service Guide

Create:
```bash
sudo nano /etc/systemd/system/gpx-route-generator.service
```

Paste:
```ini
[Unit]
Description=GPX Route Generator V5 Docker Stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/media-server/gpx-route-generator
ExecStartPre=/bin/sleep 30
ExecStart=/usr/bin/bash -lc 'cd /opt/media-server/RogueRoute-GPX/infra/docker && /usr/bin/docker compose up -d'
ExecStop=/usr/bin/bash -lc 'cd /opt/media-server/RogueRoute-GPX/infra/docker && /usr/bin/docker compose down'
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable gpx-route-generator.service
sudo systemctl start gpx-route-generator.service
sudo systemctl status gpx-route-generator.service
```
