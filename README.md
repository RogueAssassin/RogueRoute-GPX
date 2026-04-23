# RogueRoute GPX v8

Self-hosted GPX route generation built for home lab, media server, and private infrastructure setups.

Create realistic GPX walking, driving, and advanced routed tracks using a simple web interface or integrated workflows.

---

## 🚀 Quick Start (Recommended)

Install RogueRoute GPX under:

```bash
/opt/media-server/RogueRoute-GPX
```

### 1. Prepare folder

```bash
sudo mkdir -p /opt/media-server
sudo chown -R $USER:$USER /opt/media-server
```

### 2. Clone repository

```bash
cd /opt/media-server
git clone https://github.com/RogueAssassin/RogueRoute-GPX.git
cd RogueRoute-GPX
```

### 3. Fix permissions

```bash
bash ./fix-permissions.sh
```

### 4. Run first-time setup

```bash
bash ./first-run.sh
```

The installer will guide you through:

- Standard mode (recommended)
- Valhalla mode (advanced routing)

### 5. Deploy

#### Standard

```bash
./deploy.sh
```

#### Valhalla

```bash
./deploy-valhalla.sh
```

---

## 📦 Installation Modes

| Mode | Best For | Difficulty | Requirements |
|------|----------|------------|--------------|
| Standard | Most users | Beginner | Docker |
| Valhalla | Advanced routing / land-safe routes | Intermediate | Docker + more RAM + storage |

---

## 🖥️ System Requirements

### Standard Mode

Recommended:

- 2 CPU cores
- 4 GB RAM
- 10 GB free disk
- Docker Engine + Docker Compose

Better performance:

- 4 CPU cores
- 8 GB RAM

### Valhalla Mode

Recommended:

- 4 CPU cores
- 8–16 GB RAM
- 50+ GB SSD storage
- Docker Engine + Docker Compose

Large regional datasets:

- 8 CPU cores
- 16+ GB RAM

Full-world routing:

- 8+ CPU cores
- 32–64 GB RAM
- 300+ GB SSD

---

## 🧰 Official Runtime Versions

This release is tested with:

- Node.js **24.15.0** (Krypton)
- pnpm **10.33.1**
- Corepack **0.34.7**
- Docker **29.4.1**

---

## 📘 Guides

### Start Here

- [Standard Beginner Guide](docs/GUIDE-STANDARD-BEGINNER.md)
- [Valhalla Intermediate Guide](docs/GUIDE-VALHALLA-INTERMEDIATE.md)
- [System Requirements](docs/SYSTEM-REQUIREMENTS.md)

### Setup & Operations

- [Installation](docs/INSTALLATION.md)
- [Docker Deployment](docs/DOCKER-DEPLOYMENT.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Dependencies](docs/DEPENDENCIES.md)

### Advanced

- [Valhalla Build Notes](docs/VALHALLA.md)
- [Architecture](docs/ARCHITECTURE.md)

---

## 🔄 Updating

### Git Install

```bash
cd /opt/media-server/RogueRoute-GPX
git pull
./update.sh
```

### ZIP Install

Download the latest release and replace the folder contents, then run:

```bash
./update.sh
```

---

## 🩺 Health Check

Run:

```bash
./doctor.sh
```

This checks:

- Docker availability
- Node version
- pnpm version
- Port conflicts
- Required folders
- Routing mode config

---

## 🌐 Default Access URL

After deployment:

```bash
http://SERVER-IP:9080
```

Example:

```bash
http://192.168.1.10:9080
```

---

## 📁 Folder Layout

```text
/opt/media-server/
└── RogueRoute-GPX/
    ├── apps/
    ├── docs/
    ├── infra/
    ├── first-run.sh
    ├── fix-permissions.sh
    ├── deploy.sh
    ├── deploy-valhalla.sh
    ├── update.sh
    └── doctor.sh
```

---

## 🧼 Uninstall

```bash
cd /opt/media-server
rm -rf RogueRoute-GPX
```

If using Docker volumes:

```bash
docker compose down -v
```

---

## 🛠️ Troubleshooting

### `.env` missing

Run:

```bash
bash ./first-run.sh
```

or simply:

```bash
./deploy.sh
```

The installer recreates `infra/docker/.env`.

### Port 9080 already in use

Change:

```bash
HOST_PORT=9080
```

inside:

```bash
infra/docker/.env
```

### Git errors

If installed from a ZIP release, `git pull` is not required.

### pnpm `sharp` approval

This repo allows the required `sharp` build through `pnpm-workspace.yaml`.

If you still see an ignored-build warning, run:

```bash
pnpm install
pnpm ignored-builds
```

---

## ⭐ Why RogueRoute GPX?

- Self-hosted
- Beginner friendly
- Standard and advanced routing modes
- Works well on home servers
- Docker-based deployment
- Easy updates
- Expandable architecture

---

## 📜 License

Add your preferred license here.

---

## 🙌 Support

If this project helped you, please star the repo and share feedback.

```text
⭐ GitHub stars help the project grow
```
