<h1 align="center">Synk</h1>

<p align="center">
  The open-source real-time video synchronization platform.
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
  <a href="https://react.dev/">
    <img src="https://img.shields.io/badge/React-18.3-61dafb.svg?style=flat&logo=react" alt="React" />
  </a>
  <a href="https://fastapi.tiangolo.com/">
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=flat&logo=fastapi" alt="FastAPI" />
  </a>
  <a href="https://redis.io/">
    <img src="https://img.shields.io/badge/Redis-7.0-dc382d.svg?style=flat&logo=redis" alt="Redis" />
  </a>
  <a href="https://www.docker.com/">
    <img src="https://img.shields.io/badge/Docker-Compose-2496ed.svg?style=flat&logo=docker" alt="Docker" />
  </a>
</p>

<br/>

## Introduction

**Synk** is an ultra-low latency, open-source web application designed for synchronized video co-watching.

Built with an SNTP-inspired clock drift compensation algorithm (RFC 4330), Synk guarantees sub-200ms temporal alignment across participants worldwide — without browser extensions, user accounts, or advertisements.

## Features

- **Sub-200ms Drift Compensation** – Real-time kinematic extrapolation and network latency compensation.
- **Multi-Source Support** – Seamless playback across YouTube, Twitch, Vimeo, and direct MP4/HLS streams via Strategy pattern.
- **Dynamic Authority Modes** – Switch instantly between strict Host Authority (locked controls) and Collaborative Free mode.
- **Zero-Friction Ephemeral Rooms** – 1-click room creation with NanoID, shareable links, and persistent local sessions.
- **Floating Island UX** – Distraction-free, responsive dark interface built with Tailwind CSS and Radix UI primitives.
- **Resilient WebSockets** – Bidirectional Socket.IO heartbeats, auto-reconnection, and automatic host migration.

## Tech Stack

- [FastAPI](https://fastapi.tiangolo.com/) – backend ASGI framework
- [Python 3.12](https://www.python.org/) – runtime
- [Redis 7](https://redis.io/) – in-memory state & Pub/Sub
- [React 18](https://react.dev/) – UI library
- [TypeScript](https://www.typescriptlang.org/) – language
- [Vite 6](https://vite.dev/) – frontend build tool
- [Tailwind CSS](https://tailwindcss.com/) – CSS styling
- [Zustand](https://zustand.docs.pmnd.rs/) – client state management
- [Socket.IO](https://socket.io/) – real-time bidirectional communication
- [Docker](https://www.docker.com/) – containerization & orchestration

## Quickstart

### Recommended Versions

| Package | Recommended Version |
| :--- | :--- |
| **Node.js** | `>= 20.x` |
| **Python** | `>= 3.12` |
| **Docker** | `>= 24.x` |
| **uv** | `>= 0.4.x` |

### Option A: Docker Compose (Recommended)

Run the entire stack (Frontend, Backend, Redis) with a single command:

```bash
# 1. Clone the repository
git clone https://github.com/Moohmoo/Synk.git
cd Synk

# 2. Start all containers in background
docker compose up -d

# 3. View live logs
docker compose logs -f
```

**Services:**
- 🌐 **Web App:** [http://localhost:3000](http://localhost:3000)
- ⚙️ **Backend API:** [http://localhost:8000](http://localhost:8000)
- 📖 **Interactive API Docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- 🧠 **Redis Instance:** `localhost:6379`

---

### Option B: Local Development

#### 1. Backend (FastAPI & uv)
```bash
cd back
uv sync
PYTHONPATH=src uv run uvicorn main:app --reload --port 8000
```

#### 2. Frontend (React & Vite)
```bash
cd front
npm install
npm run dev
```

#### 3. Verification & Tests
```bash
# Backend pytest suite (31 unit & integration tests)
cd back && PYTHONPATH=src uv run pytest

# Frontend TypeScript check & production build
cd front && npm run build
```

## Documentation

Full architectural guides and technical specifications are available in the [`/docs`](./docs) folder:

- [Product Requirements Document (PRD)](./docs/PRD.md) – Problem statement, target personas, and scope.
- [UI/UX Flows & Design System](./docs/ui-ux-flows.md) – Floating Island layout, tokens, and responsive sheets.
- [Technical Specifications](./docs/tech-specs.md) – Architectural decisions, benchmarks, and Redis schema.
- [Frontend Architecture](./docs/front-architecture.md) – Modular tree, sync guards, and Zustand state.
- [Core Sync Algorithm](./docs/core-sync-algorithm.md) – Drift math, SNTP offset, and playback state machine.

## Contributing

1. Fork the project & create your feature branch (`git checkout -b feature/amazing-feature`).
2. Verify tests pass (`uv run pytest` and `npm run build`).
3. Commit your changes following conventional commits.
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## License

This project is open-source and licensed under the [MIT License](./LICENSE).
