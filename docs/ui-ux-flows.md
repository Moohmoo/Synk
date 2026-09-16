# Interface & Design : SYNK

> **Version:** 1.0.0-beta  
> **Style:** Clean and dark  
> **Author:** Mohmo

---

## 1. Design Principles

SYNK's interface is designed to stay minimal and functional, keeping full focus on the video:

- **Video-first:** Buttons and player controls automatically fade out after 3 seconds of playback to avoid visual distraction.
- **Clear contrast:** Deep black backdrop with a bright Cyan accent to highlight interactive elements immediately.
- **Lightweight:** Direct layout with zero clutter or heavy animations, ensuring instant loading.

---

## 2. Color Palette

| Role | Color | Usage |
| :--- | :--- | :--- |
| **Global Background** | Black (`#000000`) | Main canvas backdrop and video player frame. |
| **Surfaces & Cards** | Dark Grey (`#09090b` / `#18181b`) | Main container card, sidebars, and drawer sheets. |
| **Accent Color (Cyan)** | Cyan (`#0ac8b9`) | Primary action buttons, playback progress bar, and logo. |
| **Primary Text** | White (`#f4f4f5`) | Headings and active elements. |
| **Secondary Text** | Light Grey (`#a1a1aa`) | Timestamps, labels, and muted text. |

---

## 3. Typography

- **Headings & UI:** `Inter` for clean readability across all device screens.
- **Numbers & Codes:** `Geist Mono` for fixed-width alignment of video timestamps (`04:12 / 10:00`), room codes (`#k8F2mX`), and network ping (`18ms`).

---

## 4. Page Layouts

### 4.1. Home Page (`/`)

On desktop screens, the landing page features the left navigation sidebar and the central connection module:

```text
+-----------------------------------------------------------------------------------------+
| LEFT SIDEBAR (Desktop)   |                    MAIN CANVAS                               |
|                          |                                                              |
| [Logo] SYNK              |                                                              |
|                          |                      Start a Session                         |
| NAVIGATION               |             Create an instant room and synchronize           |
| - Home                   |                     your videos in real time.                |
|                          |                                                              |
|                          |                  [ Create a Room | Join ]                    |
|                          |                                                              |
|                          |          ┌───────────────────────────────────┬───────────┐   |
|                          |          │  Enter your username...           │  CREATE   │   |
|                          |          └───────────────────────────────────┴───────────┘   |
|                          |                                                              |
| SETTINGS                 |              [YouTube]  [Twitch: Soon]  [Direct: Soon]       |
| [FR / EN]                |                                                              |
+-----------------------------------------------------------------------------------------+
```

- **Single input field:** Serves to enter a username in create mode or paste an invitation code in join mode.
- **Instant toggle:** Switch between "Create" and "Join" with a single click.

---

### 4.2. Watch Room (`/room/:roomId`)

On desktop screens, the watch room is organized into three distinct areas:

```text
+-----------------------------------------------------------------------------------------+
| LEFT SIDEBAR   |                       VIDEO CANVAS                     | RIGHT PANEL   |
|                |                                                        |               |
| [Logo] SYNK    |  ┌──────────────────────────────────────────────────┐  | [Members] Chat|
|                |  │                                                  │  |───────────────|
| NAVIGATION     |  │                 16:9 Video Player                │  | Members (2)   |
| - Home         |  │                (or Dropzone if empty)            │  | - Alice (Host)|
|                |  │                                                  │  | - Bob         |
|                |  │ [Play] [04:12 / 10:00] [─────|─────] [Vol] [Max] │  |               |
|                |  └──────────────────────────────────────────────────┘  |               |
|                |                                                        |               |
|                |  Green Dot LIVE   Video title          [HOST CONTROL]  │───────────────|
|                |  ────────────────────────────────────────────────────  | Wifi 18ms     |
| SETTINGS       |  [SETTINGS]  Playlist (Soon)                           | #k8F2mX       |
| [FR / EN]      |  Room control lock toggle                              | [ Invite ]    |
+-----------------------------------------------------------------------------------------+
```

- **Center:** The 16:9 video player with floating overlay controls (play, pause, timeline, volume, fullscreen) and media info right underneath.
- **Right:** The connected member list with live statuses, and a bottom card showing room code, ping, and an invite copy button.

---

## 5. Mobile Adaptation

The layout adapts responsively to small screens without clutter:

- **Desktop:** Left sidebar, center player, and fixed right panel.
- **Mobile & Tablet:**
  - The left navigation sidebar collapses behind a compact burger menu button in the top-left corner.
  - The member panel opens via an upward-sliding bottom sheet (`Drawer`) right below the video.
  - The volume slider is hidden to prioritize device hardware volume buttons.
