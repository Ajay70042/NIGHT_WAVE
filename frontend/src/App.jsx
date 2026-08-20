/**
 * App — root shell.
 *
 * Two view modes:
 *   browse    (default) — BrowseView: Spotify-style home + discovery
 *   cinematic           — CinematicView: ambient scene + big title
 *
 * Shared across both modes (always mounted):
 *   PlayerBar, SearchModal, QueueDrawer, LyricsView, AmbientLayer, PocketMode
 */
import { useCallback, useEffect } from "react";
import BrowseView from "./components/BrowseView";
import CinematicView from "./components/CinematicView";
import PlayerBar from "./components/PlayerBar";
import SearchModal from "./components/SearchModal";
import QueueDrawer from "./components/QueueDrawer";
import LyricsView from "./components/LyricsView";
import AmbientLayer from "./components/AmbientLayer";
import PocketMode from "./components/PocketMode";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import usePlayerStore from "./store/usePlayerStore";
import { pingHealth } from "./lib/api";

export default function App() {
  useEffect(() => {
    pingHealth();
  }, []);

  const { seek: engineSeek } = useAudioEngine();
  const {
    progress,
    duration,
    isCinematic,
    toggleCinematic,
    currentTrack,
    isPlaying,
    setIsPlaying,
    next,
    previous,
  } = usePlayerStore();

  // Wrap seek so keyboard shortcuts can do relative seeks
  const seek = useCallback(
    (valOrFn) => {
      const nextVal = typeof valOrFn === "function" ? valOrFn(progress) : valOrFn;
      engineSeek(Math.max(0, Math.min(nextVal, duration || 9999)));
    },
    [engineSeek, progress, duration]
  );

  useKeyboardShortcuts(seek);

  // Escape key exits cinematic mode
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && isCinematic) toggleCinematic();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCinematic, toggleCinematic]);

  // ── Media Session API integration for Lock Screen / Background Controls ────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    if (currentTrack) {
      const art = currentTrack.thumbnail
        ? [
            { src: currentTrack.thumbnail, sizes: "96x96", type: "image/jpeg" },
            { src: currentTrack.thumbnail, sizes: "128x128", type: "image/jpeg" },
            { src: currentTrack.thumbnail, sizes: "192x192", type: "image/jpeg" },
            { src: currentTrack.thumbnail, sizes: "256x256", type: "image/jpeg" },
            { src: currentTrack.thumbnail, sizes: "384x384", type: "image/jpeg" },
            { src: currentTrack.thumbnail, sizes: "512x512", type: "image/jpeg" },
          ]
        : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || "NightWave",
        artist: currentTrack.artist || "NightWave Music",
        album: "NightWave",
        artwork: art,
      });
    }

    // Action Handlers
    const safeSetHandler = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (_) {}
    };

    safeSetHandler("play", () => setIsPlaying(true));
    safeSetHandler("pause", () => setIsPlaying(false));
    safeSetHandler("previoustrack", () => previous());
    safeSetHandler("nexttrack", () => next());
    safeSetHandler("stop", () => setIsPlaying(false));

    safeSetHandler("seekto", (details) => {
      if (details.seekTime !== undefined && details.seekTime !== null) {
        seek(details.seekTime);
      }
    });

    safeSetHandler("seekbackward", (details) => {
      const skip = details.seekOffset || 10;
      seek((prev) => Math.max(0, prev - skip));
    });

    safeSetHandler("seekforward", (details) => {
      const skip = details.seekOffset || 10;
      seek((prev) => Math.min(duration || 9999, prev + skip));
    });
  }, [currentTrack, isPlaying, setIsPlaying, previous, next, seek, duration]);

  // Sync position state with lock screen seekbar
  useEffect(() => {
    if ("mediaSession" in navigator && "setPositionState" in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0.1, duration),
          playbackRate: 1.0,
          position: Math.min(Math.max(0, progress), duration),
        });
      } catch (_) {}
    }
  }, [progress, duration]);

  return (
    <>
      {/* Ambient sound mixer (invisible, Web Audio) */}
      <AmbientLayer />

      {/* AMOLED Pocket Mode / Lock Shield */}
      <PocketMode />

      {/* ── View layer ── */}
      {isCinematic ? (
        /* Cinematic overlay — full screen ambient mode */
        <CinematicView seek={seek} />
      ) : (
        /* Browse home — default view */
        <BrowseView />
      )}

      {/* ── Persistent overlays ── */}
      {!isCinematic && <PlayerBar seek={seek} />}
      <QueueDrawer />
      <LyricsView seek={seek} />
      <SearchModal />
    </>
  );
}
