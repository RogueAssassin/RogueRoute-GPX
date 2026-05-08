# OSRM Setup

V10 is OSRM-only.

## Default planet setup using `/mnt/h`

```bash
sudo mkdir -p /mnt/h/osrm
# Put your downloaded .osm.pbf directly in /mnt/h/osrm, for example:
# /mnt/h/osrm/australia-latest.osm.pbf
cp infra/docker/.env.osrm infra/docker/.env
./prepare-osrm.sh region australia
./deploy.sh osrm
```

## Important planet warning

Planet mode can require 500GB+ free disk and many hours. Regional extracts are strongly recommended for normal installs.

## Profiles

Set one before preparing data:

```env
OSRM_PROFILE=foot
# OSRM_PROFILE=bike
# OSRM_PROFILE=car
```

Changing profile requires rerunning `./prepare-osrm.sh`.
