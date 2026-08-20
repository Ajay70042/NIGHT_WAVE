/**
 * App — root shell.
 *
 * Two view modes:
 *   browse    (default) — BrowseView: Spotify-style home + discovery
 *   cinematic           — CinematicView: ambient scene + big title
 *
 * Shared across both modes (always mounted):
 *   PlayerBar, SearchModal, QueueDrawer, LyricsView, AmbientLayer
 */
import { useCallback, useEffect } from "react";
import BrowseView from "./components/BrowseView";
import CinematicView from "./components/CinematicView";
import PlayerBar from "./components/PlayerBar";
import SearchModal from "./components/SearchModal";
import QueueDrawer from "./components/QueueDrawer";
import LyricsView from "./components/LyricsView";
import AmbientLayer from "./components/AmbientLayer";
import { useAudioEngine } from "./hooks/useAudioEngine";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import usePlayerStore from "./store/usePlayerStore";
import { pingHealth } from "./lib/api";

export default function App() {
  useEffect(() => {
    pingHealth();
  }, []);
  const { seek: engineSeek } = useAudioEngine();
  const { progress, isCinematic, toggleCinematic, currentTrack, isPlaying, setIsPlaying, next, previous } = usePlayerStore();

  // Wrap seek so keyboard shortcuts can do relative seeks
  const seek = useCallback(
    (valOrFn) => {
      const next = typeof valOrFn === "function" ? valOrFn(progress) : valOrFn;
      engineSeek(next);
    },
    [engineSeek, progress]
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

  // Media Session API integration for Lock Screen / Background Controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    if (currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist || "Unknown Artist",
        album: "NightWave",
        artwork: currentTrack.thumbnail
          ? [
              { src: currentTrack.thumbnail, sizes: "96x96", type: "image/jpeg" },
              { src: currentTrack.thumbnail, sizes: "128x128", type: "image/jpeg" },
              { src: currentTrack.thumbnail, sizes: "256x256", type: "image/jpeg" },
              { src: currentTrack.thumbnail, sizes: "512x512", type: "image/jpeg" },
            ]
          : [],
      });
    }

    navigator.mediaSession.setActionHandler("play", () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler("pause", () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler("previoustrack", () => previous());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (details.fastSeek && "fastSeek" in HTMLMediaElement.prototype) return;
      seek(details.seekTime);
    });
  }, [currentTrack, isPlaying, setIsPlaying, previous, next, seek]);

  // Sync position state with lock screen seekbar
  const { duration } = usePlayerStore();
  useEffect(() => {
    if ("mediaSession" in navigator && "setPositionState" in navigator.mediaSession && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
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
