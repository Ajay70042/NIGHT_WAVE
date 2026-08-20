# 🌌 NightWave — Tomorrow's Development Roadmap

This document outlines the planned features, enhancements, and tasks to execute next for **NightWave**.

---

## 🚗 1. Cyberpunk "Night Drive" Background Animation
- [ ] **Endless Highway Drive Animation:** Create a canvas/CSS animated synthwave night drive in the background (sleek car, retro grid road, neon skyline/sunset, starry horizon).
- [ ] **Audio-Reactive Accents:** Subtle speed, neon glow, or taillight pulse tied to playback rhythm.
- [ ] **Scene Switcher:** Quick toggle in the top bar to switch between:
  1. *Night Drive (Car & Highway)*
  2. *Vinyl Disc & Visualizer*
  3. *Ambient Gradient Mesh*

---

## 🔄 2. Infinite Autoplay & Smart Recommendations (Completed)
- [x] **Continuous Playback:** When a track finishes and the user's manual queue is empty, never stop the music.
- [x] **Similar Song Recommendations:** Fetch related/similar tracks using `ytmusicapi` watch/radio endpoints (`/api/suggestions`).
- [x] **Auto-Queue & UI:** Automatically append recommendations in `usePlayerStore`, display station in `QueueDrawer`, and provide toggle controls in `PlayerBar`.


---

## 🎤 3. Multi-Source Free Lyrics (100% Free / Synced Karaoke Mode) (Completed)
- [x] **Multiple Free Providers:**
  - **LRCLIB** (Studio synced LRC timestamps)
  - **NetEase Cloud Music** (50M+ synchronized global & regional catalog)
  - **YouTube Captions / Subtitles** (Millisecond auto & manual subtitles via `yt-dlp`)
  - **lyrics.ovh** (Broad plain-text fallback)
- [x] **Smart Title Cleaning:** Automatically strip `(Official Video)`, `feat. X`, `[4K]`, etc., to maximize match rates.
- [x] **Intelligent Auto-Sync Engine:** Automatically transforms plain-text lyrics into timestamped auto-scrolling karaoke lines.
- [x] **Interactive Click-to-Seek:** Click any line in the lyrics drawer to jump playback directly to that timestamp.

---

## ☁️ 4. Online Deployment (Completed)
- [x] **Backend Deployment:** Live on Render at `https://nightwave-api.onrender.com`.
- [x] **Frontend Deployment:** Live on Vercel with automatic API proxy rewrites in `vercel.json`.
- [x] **Cold-Start Resilience:** Auto-retries with exponential backoff on page load and search.

---

## 📱 5. UX, Mobile & Media Session Controls (Completed)
- [x] **Media Session API:** Hook into OS lock-screen / notification controls (play, pause, next, artwork on mobile & Windows media overlays).
- [x] **Mobile Responsive Polish:** Ensure the bottom player bar, search modal, queue drawer, and lyrics panel fit screens of all sizes.
- [x] **Local Storage Favorites & History:** Ability to "Heart" tracks and save recent listening history locally.

---
*Created on: August 19, 2026*
