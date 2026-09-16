# Architecture : SYNK

> **Version:** 1.0.0-beta  
> **Author:** Mohmo

---

## 1. System Overview

SYNK is built on a straightforward 3-tier architecture:

```text
[ Web Client (Browser) ]
       │
       │ HTTP (Room creation) + WebSocket (Real-time sync)
       ▼
[ Backend Server (FastAPI) ]
       │
       │ Temporary in-memory storage
       ▼
[ Redis Datastore (Room state + Auto-cleanup) ]
```

1. **Frontend (React):** Renders the interface, plays the YouTube video, and listens to user actions (play, pause, seek).
2. **Backend (FastAPI):** Receives playback events, verifies host permissions, and broadcasts the exact room position to all participants over WebSockets.
3. **Redis Store:** Keeps room state in memory (current second, active users) and automatically deletes rooms when everyone leaves.

---

## 2. Code Structure

### 2.1. Frontend (`front/src`)

- `components/`: Reusable buttons, navigation sidebar, and video player.
- `views/`: The two main app views:
  - `home/`: Landing page to create a room or join with a code.
  - `room/`: Video watch room with player, controls, and participant list.
- `hooks/`: Core business logic (automatic video sync, keyboard shortcuts, WebSocket connection).
- `stores/`: Lightweight visual state (tracks whether the sidebar is collapsed).
- `services/`: API client functions to communicate with the backend.

### 2.2. Backend (`back/src`)

- `api/`: HTTP endpoints (create a room, check if a code exists).
- `domains/room/`: Core room logic (participant management, playback events, reference time calculation).
- `core/`: Configuration, anti-spam rate limiting, and WebSocket connection setup.
- `db/`: Direct connection to Redis.

---

## 3. Tech Choices

### 3.1. React + Vite (instead of Next.js)
SYNK is a private, real-time web application. It does not need search engine indexing (SEO) on ephemeral rooms. A React SPA bundled with Vite is much lighter, boots instantly, and makes persistent WebSocket connections simpler to manage.

### 3.2. FastAPI (Python) (instead of Node.js / Express)
FastAPI provides clean, typed, and automatically validated code (using Pydantic). It delivers excellent async performance while keeping the codebase ready for future Python-based multimedia tooling.

### 3.3. Redis (instead of a disk-based SQL database)
Watch rooms are temporary by nature. Writing to a disk database would add unnecessary latency and require cron jobs to delete old sessions. With Redis, everything stays in fast RAM and inactive rooms delete themselves automatically.

### 3.4. Zustand (instead of Redux)
Zustand weighs under 1 KB and requires zero boilerplate. It handles simple UI preferences (sidebar state) cleanly without slowing down the application.

---

## 4. Room Data & Security

Each active room is represented in Redis by two records:

1. **Room State (`room:{id}`):**
   - Room identifier and creation timestamp.
   - Current media state (YouTube URL, playback position in seconds, play/pause state).
   - Room settings (host-only controls or free mode).
   - Connected participant list with live ping values.
2. **Host Secret (`room:{id}:host_token`):**
   - A secret token stored only in the creator's browser.
   - Proves room ownership when changing restricted settings or deleting the room.

---

## 5. Automatic Cleanup

To prevent memory bloat on the server:
- **Unclaimed room (created but never joined):** Deleted after **5 minutes**.
- **Empty room (all participants left):** Deleted after **10 minutes**.
- **Active room:** Extends its lifetime by **2 hours** on every user action.
