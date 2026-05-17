# RogueRoute GPX v11 upgrade guide

Use this when upgrading an existing server copy.

## 1. Unpack and fix executable permissions

```bash
bash fix-permissions.sh
chmod +x *.sh infra/scripts/*.sh
```

## 2. Repair local dependencies

This clears common `tsc: Permission denied`, missing `node_modules`, and root-owned pnpm binary issues.

```bash
./repair-deps.sh
```

## 3. Check OSRM before restarting

```bash
./diagnose-osrm.sh
```

If the graph is incomplete, repair map builds first:

```bash
./prepare-osrm.sh repair list
./repair-osm-builds.sh
```

## 4. Clean rebuild the web app

```bash
./clean-rebuild.sh osrm
```

## 5. Confirm status

```bash
./status.sh
./diagnose-osrm.sh
```

Open the web UI and use the reset browser cache button once after the clean rebuild.
