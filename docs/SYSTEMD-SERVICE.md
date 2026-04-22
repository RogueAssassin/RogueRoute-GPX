# Systemd Service Guide

Use restart scripts for boot-time startup. Do not use deploy scripts in systemd, because boot recovery should not pull Git or rebuild the workspace.

## Standard service
Create:

```bash
sudo nano /etc/systemd/system/rogueroute-gpx.service
```

Paste:

```ini
[Unit]
Description=RogueRoute GPX (Standard)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
ConditionPathExists=/opt/media-server/RogueRoute-GPX

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/media-server/RogueRoute-GPX
ExecStartPre=/bin/sleep 15
ExecStart=/usr/bin/bash -lc './restart.sh'
ExecStop=/usr/bin/bash -lc './stop.sh'
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

## Valhalla Enhanced service
Create:

```bash
sudo nano /etc/systemd/system/rogueroute-gpx-valhalla.service
```

Paste:

```ini
[Unit]
Description=RogueRoute GPX (Valhalla Enhanced)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target
ConditionPathExists=/opt/media-server/RogueRoute-GPX

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/media-server/RogueRoute-GPX
ExecStartPre=/bin/sleep 20
ExecStart=/usr/bin/bash -lc './restart-valhalla.sh'
ExecStop=/usr/bin/bash -lc './stop.sh'
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

## Enable and start
```bash
sudo systemctl daemon-reload
sudo systemctl enable rogueroute-gpx.service
sudo systemctl start rogueroute-gpx.service
sudo systemctl status rogueroute-gpx.service
```

For Valhalla Enhanced, enable `rogueroute-gpx-valhalla.service` instead.

## Notes
- Keep `VALHALLA_DATA_PATH` on a stable mounted path.
- If your Valhalla data lives on another drive, make sure that mount is available before systemd starts the service.
- Use `journalctl -u rogueroute-gpx.service -f` or `journalctl -u rogueroute-gpx-valhalla.service -f` for service logs.
