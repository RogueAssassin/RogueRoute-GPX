# Installation

## Clone the repo
```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
```

## Create the Docker env file
```bash
cp infra/docker/.env.example infra/docker/.env
```

Edit `infra/docker/.env` and set the values you need.

## Install dependencies
```bash
./install.sh
```

## Deploy the web app
```bash
./deploy.sh
```

## Deploy with Valhalla
```bash
./deploy-valhalla.sh
```

## Clean refresh later
When the repo changes significantly and you want to remove stale files from older versions:

```bash
./refresh.sh
```

With Valhalla:
```bash
./refresh-valhalla.sh
```
