# PRD : SYNK

> **Version:** 1.0.0-beta  
> **Status:** MVP  
> **Author:** Mohmo

---

## 1. Vision & Purpose

### 1.1. The Problem
Watching videos together remotely is often frustrating:
- **The "3, 2, 1, Play" countdown:** Counting down over microphone on Discord or WhatsApp never works and causes echo or lag.
- **Pausing ruins everything:** As soon as someone pauses or has a connection hiccup, everyone gets desynchronized.
- **Extensions don't work on mobile:** Existing tools require browser extensions that are impossible to use on smartphones or tablets.
- **Too many friction points:** Most websites force user sign-up or clutter the screen with pop-up ads.

### 1.2. The Solution: SYNK
An instant, zero-account, ad-free web app:
1. Paste a video link (YouTube).
2. Share the room link with friends.
3. Everyone watches the video aligned to the exact same second, on laptop or phone.

---

## 2. Target Audience

Anyone who wants to share a video moment remotely (friends, couples, families) without having to install an app or create an account.

---

## 3. Features

### 3.1. What the App Does (MVP)
- **Instant rooms:** 1-click room creation with a unique code. The room automatically deletes itself after 10 minutes of inactivity.
- **Zero sign-up:** A simple username is all you need. The room creator automatically keeps host permissions in their browser.
- **Synchronized player:** Play, pause, and seek for all participants on YouTube.
- **Automatic realignment:** If a friend joins late or their connection lags, the player automatically catches up to the right second. A "Catch Up" button appears if lag exceeds 2 seconds.
- **Room permissions:** The host can lock controls (host-only playback) or leave the room in free mode. If the host leaves, another member automatically becomes host.
- **Live presence:** Participant counter and list with real-time ping indicator for each user.

### 3.2. Future Improvements
- **Queue / Playlist:** Add multiple videos in advance without having to paste a link every time.
- **New streams:** Support additional video sources and formats.

---

## 4. Rules & Edge Cases

| Scenario | What Should Happen | System Behavior |
| :--- | :--- | :--- |
| **Joining mid-video** | Join without interrupting others. | Server immediately sends current playback position and state. |
| **Tiny drift (< 0.5s)** | Normal unnoticeable variation. | No forced seek to keep audio smooth and uninterrupted. |
| **Moderate drift (0.5s to 2s)** | Realignment needed. | Player quietly realigns video to the target second. |
| **Heavy network lag (> 2s)** | User fell behind. | A "Catch Up" button appears to resync in one click. |
| **Host leaves** | Room should not stay locked. | Host permissions automatically transfer to the next active member. |
| **Empty room** | Free up server memory. | Room is automatically deleted after 10 minutes with zero users. |

---

## 5. Success Criteria

- **Synchronization:** Less than 200ms drift between participants on a standard connection.
- **Instant:** Room ready to use in under 10 seconds.
- **Cross-platform:** Runs smoothly on phones, tablets, and desktops.
