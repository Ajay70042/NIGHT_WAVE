<div align="center">

# Murgichor

**A fast, cinematic Windows desktop music player powered by YouTube Music.**

[![Download for Windows](https://img.shields.io/badge/Download_for_Windows-Murgichor_Setup.exe-7c3aed?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Ajay70042/NIGHT_WAVE/releases/latest/download/Murgichor_Setup.exe)
[![Version](https://img.shields.io/badge/Version-1.0.0-18181b?style=for-the-badge)](https://github.com/Ajay70042/NIGHT_WAVE/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows_10_%2F_11_(x64)-18181b?style=for-the-badge)](https://github.com/Ajay70042/NIGHT_WAVE/releases/latest)

</div>

---

## Quick Install (Windows 10 / 11)

1. Click **[Download Murgichor_Setup.exe](https://github.com/Ajay70042/NIGHT_WAVE/releases/latest/download/Murgichor_Setup.exe)** (1-click download).
2. Double-click `Murgichor_Setup.exe` to install.
   > **Note:** Since the installer is unsigned, Windows SmartScreen may appear on first launch — click **More info → Run anyway**.
3. Open **Murgichor** from your Desktop or Start Menu, go to **Settings → Connect Account**, and sign in with your Google / YouTube Music account.

---

## Features

- **Two-Way YouTube Music Sync** — Your playlists, liked songs, and listening history stay in sync between your phone and desktop. Liking songs, playing tracks, or creating playlists in Murgichor updates your YouTube Music account automatically.
- **1-Click Google Sign-In** — Sign in directly inside an isolated login window; switch or disconnect accounts anytime.
- **Full Screen & Synced Lyrics Modes** — Centered artwork with soothing ambient background lighting, millisecond-synced lyrics with tap-to-seek, and auto-hiding controls when idle.
- **Smart YouTube Music Radio Queue** — Automatically queues related tracks without repeating recently played songs, with a floating glass Up Next panel and drag-to-reorder.
- **Moods & Genres Discovery** — Browse real YouTube Music moods, genres, and charts.
- **Fast Search & History** — Instant YouTube Music search with saved recent search history.
- **Smooth 90–120 Hz UI** — GPU-composited animations and frameless single-line titlebar.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` | Play / Pause |
| `Right` / `Left` | Seek forward / backward 5 seconds |
| `Ctrl + Right` / `Ctrl + Left` | Next / Previous track |
| `F` | Toggle Full Screen / Lyrics (remembers last mode) |
| `L` or `Q` | Toggle Queue |
| `K` or `Ctrl + K` | Focus Search |
| `Ctrl + B` | Toggle Sidebar |
| `Esc` | Close Full Screen / Lyrics |

---

## Tech Stack

- **Desktop Shell:** Tauri v2 (Rust + WebView2)
- **Frontend:** React, Vite, Tailwind CSS, Framer Motion, Zustand
- **Audio & Metadata Engine:** Python, FastAPI, Uvicorn, `ytmusicapi`, `yt-dlp`
