# Installation

## 1. Clone the repo
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
```

## 2. Fix permissions first
This step is safe to run on any username because the script automatically uses the current account.

```bash
bash fix-permissions.sh
```

## 3. Create the Docker env file
```bash
cp infra/docker/.env.example infra/docker/.env
```

Open it and adjust the values you need:

```bash
nano infra/docker/.env
```

## 4. First-time install
```bash
bash first-run.sh
```

## 5. Deploy the web app
```bash
./deploy.sh
```

## 6. Deploy with Valhalla
Only do this after `VALHALLA_DATA_PATH` is set and your map data exists there.

```bash
./deploy-valhalla.sh
```

## Simplest path for complete beginners
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
bash fix-permissions.sh
cp infra/docker/.env.example infra/docker/.env
nano infra/docker/.env
bash first-run.sh
./deploy.sh
```
