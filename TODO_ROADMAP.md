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

## 🎤 3. Multi-Source Free Lyrics (100% Free / No API Key)
- [ ] **Multiple Free Providers:**
  - **LRCLIB** (Current: Synced LRC timestamps)
  - **Genius API Scraper** (Fallback: Massive international & Hindi / regional catalog)
  - **lyrics.ovh** (Fallback: Quick REST lookup)
- [ ] **Smart Title Cleaning:** Strip noise from search titles (e.g. `(Official Video)`, `[Lyrics]`, `(From "Movie")`) to drastically increase lyrics match rates.
- [ ] **Plain Text Lyrics Formatting:** Beautiful typography & scrolling for songs that don't have synchronized LRC timestamps.

---

## ☁️ 4. Online Deployment (Play from Anywhere / Mobile)
- [ ] **Backend Deployment:** Deploy FastAPI on Railway / Render (free tier, persistent 24/7).
- [ ] **Frontend Deployment:** Deploy Vite React build on Vercel / Netlify with custom domain / HTTPS.
- [ ] **Cross-Device Testing:** Verify search, lyrics, and YouTube audio playback from smartphones and other computers.

---

## 📱 5. UX, Mobile & Media Session Controls (Completed)
- [x] **Media Session API:** Hook into OS lock-screen / notification controls (play, pause, next, artwork on mobile & Windows media overlays).
- [x] **Mobile Responsive Polish:** Ensure the bottom player bar, search modal, queue drawer, and lyrics panel fit screens of all sizes.
- [x] **Local Storage Favorites & History:** Ability to "Heart" tracks and save recent listening history locally.

---
*Created on: August 19, 2026*
