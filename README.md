<h1 align="center">
  <sub><img src="./front/public/favicon.svg" width="32" height="32" alt="Synk" /></sub> Synk
</h1>

<p align="center">
  Watch videos together in sync with friends.
  <br />
  <br />
  <a href="#introduction"><strong>Introduction</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
  <a href="#quickstart"><strong>Quickstart</strong></a> ·
  <a href="#documentation"><strong>Documentation</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a>
</p>

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/release-v1.0.0--beta-teal.svg?style=flat" alt="Version" />
</p>

<br/>

## Introduction

**Synk** is a lightweight, open-source web app that lets you watch videos in sync with friends.

No account to create, no browser extensions to install, and zero ads. Just generate a room link, paste your video URL, and enjoy the show together in real time.

## Features

- **Real-Time Sync** – Play, pause, and seek stay aligned across everyone's screens in real time.
- **Watch Anything** – Paste links from YouTube, Twitch, Vimeo, or direct video files (.mp4, .m3u8).
- **Host or Free Mode** – Keep full control of playback as the room host, or let everyone control the player together.
- **Zero Friction** – Create a room in 1 click, share the URL, and start watching immediately.
- **Mobile & Desktop** – A clean, distraction-free dark interface that works seamlessly on phones, tablets, and laptops.

## Tech Stack

- [FastAPI](https://fastapi.tiangolo.com/) – backend API
- [Python 3.12](https://www.python.org/) – backend language
- [Redis 7](https://redis.io/) – in-memory state & real-time messaging
- [React 18](https://react.dev/) – web interface
- [TypeScript](https://www.typescriptlang.org/) – frontend language
- [Vite 6](https://vite.dev/) – build tool
- [Tailwind CSS](https://tailwindcss.com/) – styling
- [Socket.IO](https://socket.io/) – real-time communication
- [Docker](https://www.docker.com/) – containerization

## Quickstart

### Recommended Versions

| Package | Recommended Version |
| :--- | :--- |
| **Node.js** | `>= 20.x` |
| **Python** | `>= 3.12` |
| **Docker** | `>= 24.x` |
| **uv** | `>= 0.4.x` |

### Option A: Docker Compose (Recommended)

Run the entire stack with a single command:

```bash
# 1. Clone the repository
git clone https://github.com/Moohmoo/Synk.git
cd Synk

# 2. Start all services
docker compose up -d

# 3. View logs
docker compose logs -f
```

**Open in your browser:**
- 🌐 **Web App:** [http://localhost:3000](http://localhost:3000)
- ⚙️ **Backend API:** [http://localhost:8000](http://localhost:8000)
- 📖 **API Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option B: Local Development

#### 1. Backend
```bash
cd back
uv sync
PYTHONPATH=src uv run uvicorn main:app --reload --port 8000
```

#### 2. Frontend
```bash
cd front
npm install
npm run dev
```

#### 3. Tests
```bash
# Run backend tests
cd back && PYTHONPATH=src uv run pytest

# Build frontend
cd front && npm run build
```

## Documentation

For developers looking for deep architectural details, algorithmic formulas, and internal specs, check out the [`/docs`](./docs) folder:

- [Product Requirements Document (PRD)](./docs/PRD.md) – Product vision, scope, and user flows.
- [UI/UX Flows & Design System](./docs/ui-ux-flows.md) – Layout philosophy, color tokens, and mobile experience.
- [Technical Specifications](./docs/tech-specs.md) – Architectural decisions, benchmarks, and data schemas.
- [Frontend Architecture](./docs/front-architecture.md) – Directory structure, routing, and state management.
- [Core Sync Algorithm](./docs/core-sync-algorithm.md) – Clock synchronization math, ping handling, and state machines.

## Contributing

1. Fork the project & create a branch (`git checkout -b feature/my-feature`).
2. Make sure tests pass (`uv run pytest` and `npm run build`).
3. Commit your changes.
4. Push to your fork and submit a Pull Request.

## License

This project is open-source and licensed under the [MIT License](./LICENSE).
