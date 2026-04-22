# Changelog

## v7.5.0
- added smart Valhalla deployment planning based on the contents of `VALHALLA_DATA_PATH`
- made `deploy-valhalla.sh` and `refresh-valhalla.sh` prefer source `.osm.pbf` files over stale generated tiles when smart repair is enabled
- added `repair-valhalla.sh` to stop the container, remove broken generated tile outputs, and preserve source map files
- updated the Valhalla compose override to set `use_tiles_ignore_pbf=False`
- expanded README and setup docs with the new repair workflow and clearer beginner guidance
- aligned the IITC userscript metadata and release version to v7.5.0

## v7.0.1
- added `fix-permissions.sh` for username-agnostic Linux and WSL permission repair
- added `first-run.sh` for simpler first-time setup
- rewrote README and beginner docs for easier onboarding
- expanded Valhalla guidance with practical full-world file-size and hardware planning
- improved GitHub Desktop guide and beginner troubleshooting

## v7.0.0
- promoted the deployment polish track into a full major-release packaging pass
- added `refresh.sh` and `refresh-valhalla.sh` for clean server re-pulls that preserve external Valhalla data
- documented the safe `git fetch` + `git reset --hard` + `git clean` refresh flow
- added a dedicated GitHub Desktop guide for cloning, committing, and pushing the project
- tightened `.gitignore`, `.dockerignore`, and added `.gitattributes` for cleaner cross-platform repository behavior
- updated README, installation, Docker, Valhalla, and troubleshooting guides to match the refreshed deployment workflow
- bumped IITC userscript metadata and in-plugin version to v7.0.0

## v6.4.5
- added root-level wrapper commands: `install.sh`, `deploy.sh`, `deploy-valhalla.sh`, `update.sh`, `status.sh`, `logs.sh`, `logs-valhalla.sh`, and `stop.sh`
- added safer helper-script preflight checks for Docker, Docker Compose, env file presence, port warnings, and Valhalla data availability
- updated README and install guides to use the simpler root-level commands with `infra/docker/.env`
- clarified WSL `H:\Valhalla` mounting through `/mnt/h/Valhalla`
- aligned docs and deployment guidance around `infra/docker/.env.example`
- bumped IITC userscript metadata and in-plugin version to v6.4.5

## v6.4.2
- moved `.env.example` into `infra/docker/.env.example`
- updated helper scripts to resolve and use `infra/docker/.env`
- aligned README/install flow with Docker-folder env layout

## v6.4.0
- aligned IITC userscript metadata and branding with RogueRoute GPX v6.4
- added Tampermonkey auto-update metadata via `@version`, `@updateURL`, and `@downloadURL`
- updated README with WSL and Valhalla setup guidance
- added `VALHALLA_DATA_PATH` to `.env.example`
- fixed Valhalla compose override to mount host data into `/custom_files`
- added dedicated Valhalla setup and troubleshooting docs
- documented regional global-coverage map pack downloads
