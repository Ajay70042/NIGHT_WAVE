/**
 * useAudioEngine — Instant YouTube IFrame Player with High-Precision Synced Lyrics & Audio Anchor
 *
 * Fast 0ms Playback:
 * - Instant track startup on PC and mobile via YouTube IFrame API.
 * - 50ms high-precision progress ticker for fluid word-by-word synced karaoke lyrics.
 * - Audio session priming and Screen Wake Lock management.
 */
import { useEffect, useRef, useCallback } from "react";
import usePlayerStore from "../store/usePlayerStore";

// Load YouTube IFrame API script once
function loadYTScript() {
  if (window.YT || document.getElementById("yt-iframe-api")) return;
  const tag = document.createElement("script");
  tag.id = "yt-iframe-api";
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

// 2-second PCM WAV silent audio generator to anchor audio hardware
let cachedSilentBlobUrl = null;
function getSilentAudioBlobUrl() {
  if (cachedSilentBlobUrl) return cachedSilentBlobUrl;
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate * 2;
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    const blob = new Blob([buffer], { type: "audio/wav" });
    cachedSilentBlobUrl = URL.createObjectURL(blob);
    return cachedSilentBlobUrl;
  } catch (e) {
    return "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
}

export function useAudioEngine() {
  const playerRef          = useRef(null);   // YT.Player instance
  const containerRef       = useRef(null);   // in-viewport container for iframe
  const silentAudioRef     = useRef(null);   // silent audio element
  const wakeLockRef        = useRef(null);   // Screen Wake Lock handle
  const analyserRef        = useRef(null);   // Visualizer simulated ref
  const readyRef           = useRef(false);
  const pendingIdRef       = useRef(null);   // videoId to load when player is ready
  const switchingTrackRef  = useRef(false);
  const intendedPlayingRef = useRef(false);
  const switchTimeoutRef   = useRef(null);

  const {
    streamUrl,
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    setProgress,
    setDuration,
    setIsPlaying,
    next,
    repeatMode,
  } = usePlayerStore();

  // ── Screen Wake Lock Manager ───────────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator && !wakeLockRef.current && document.visibilityState === "visible") {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
        });
      } catch (_) {}
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (_) {}
      wakeLockRef.current = null;
    }
  }, []);

  // ── Initialize Player Container & YouTube IFrame ──────────────────────────
  useEffect(() => {
    let div = document.getElementById("yt-player-container");
    if (!div) {
      div = document.createElement("div");
      div.id = "yt-player-container";
      div.style.cssText =
        "position:fixed;top:0;left:0;width:200px;height:200px;opacity:0.001;pointer-events:none;z-index:-9999;overflow:hidden;";
      document.body.appendChild(div);
    }
    containerRef.current = div;

    let audio = document.getElementById("nightwave-bg-audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "nightwave-bg-audio";
      audio.src = getSilentAudioBlobUrl();
      audio.loop = true;
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.001;pointer-events:none;";
      document.body.appendChild(audio);
    }
    silentAudioRef.current = audio;

    const primeAudioGesture = () => {
      if (audio) {
        audio.play().then(() => {
          if (!usePlayerStore.getState().isPlaying) {
            audio.pause();
          }
        }).catch(() => {});
      }
      window.removeEventListener("touchstart", primeAudioGesture);
      window.removeEventListener("pointerdown", primeAudioGesture);
      window.removeEventListener("click", primeAudioGesture);
    };
    window.addEventListener("touchstart", primeAudioGesture, { passive: true });
    window.addEventListener("pointerdown", primeAudioGesture, { passive: true });
    window.addEventListener("click", primeAudioGesture, { passive: true });

    loadYTScript();

    const initPlayer = () => {
      if (playerRef.current) return;
      const player = new window.YT.Player(div, {
        width:  "200",
        height: "200",
        videoId: "",
        playerVars: {
          autoplay:       1,
          controls:       0,
          disablekb:      1,
          fs:             0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel:            0,
          playsinline:    1,
          origin:         window.location.origin,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            player.setVolume(Math.round(
              (usePlayerStore.getState().isMuted ? 0 : usePlayerStore.getState().volume) * 100
            ));
            if (pendingIdRef.current) {
              const vid = pendingIdRef.current;
              pendingIdRef.current = null;
              switchingTrackRef.current = true;
              intendedPlayingRef.current = true;
              player.loadVideoById({ videoId: vid, startSeconds: 0 });
              try { player.playVideo(); } catch (_) {}
            }
          },
          onStateChange: (e) => {
            const YT = window.YT.PlayerState;
            if (e.data === YT.PLAYING) {
              switchingTrackRef.current = false;
              intendedPlayingRef.current = true;
              usePlayerStore.getState().setIsPlaying(true);
              const dur = player.getDuration?.() || 0;
              if (dur > 0) usePlayerStore.getState().setDuration(dur);
            } else if (e.data === YT.BUFFERING) {
              if (intendedPlayingRef.current) {
                usePlayerStore.getState().setIsPlaying(true);
              }
            } else if (e.data === YT.PAUSED) {
              if (switchingTrackRef.current) {
                try { player.playVideo(); } catch (_) {}
                return;
              }
              if (!intendedPlayingRef.current) {
                usePlayerStore.getState().setIsPlaying(false);
              }
            } else if (e.data === YT.ENDED) {
              switchingTrackRef.current = false;
              const rm = usePlayerStore.getState().repeatMode;
              if (rm === "one") {
                player.seekTo(0);
                player.playVideo();
              } else {
                usePlayerStore.getState().next();
              }
            }
          },
          onError: (e) => {
            console.error("YT Player error:", e.data);
            switchingTrackRef.current = false;
            if (e.data === 101 || e.data === 150 || e.data === 100 || e.data === 2) {
              setTimeout(() => {
                usePlayerStore.getState().next();
              }, 300);
            }
          },
        },
      });
      playerRef.current = player;
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      window.removeEventListener("touchstart", primeAudioGesture);
      window.removeEventListener("pointerdown", primeAudioGesture);
      window.removeEventListener("click", primeAudioGesture);
    };
  }, []);

  // ── Load new video when streamUrl changes (Instant 0ms) ───────────────────
  useEffect(() => {
    if (!streamUrl) return;
    const videoId = streamUrl;

    intendedPlayingRef.current = true;
    switchingTrackRef.current = true;

    const audio = silentAudioRef.current;
    if (audio) {
      audio.play().catch(() => {});
    }

    if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
    switchTimeoutRef.current = setTimeout(() => {
      switchingTrackRef.current = false;
    }, 2000);

    if (!readyRef.current || !playerRef.current) {
      pendingIdRef.current = videoId;
      return;
    }

    try {
      playerRef.current.loadVideoById({ videoId, startSeconds: 0 });
      playerRef.current.playVideo();
    } catch (e) {
      console.error("YT loadVideoById error:", e);
    }
  }, [streamUrl]);

  // ── Sync play/pause from Zustand ──────────────────────────────────────────
  useEffect(() => {
    intendedPlayingRef.current = isPlaying;
    const p = playerRef.current;
    const audio = silentAudioRef.current;

    if (isPlaying) {
      if (audio) audio.play().catch(() => {});
      if (p && readyRef.current && !switchingTrackRef.current) {
        try { p.playVideo(); } catch (e) {}
      }
      requestWakeLock();
    } else {
      if (audio) audio.pause();
      if (p && readyRef.current && !switchingTrackRef.current) {
        try { p.pauseVideo(); } catch (e) {}
      }
      releaseWakeLock();
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  // ── Volume ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      p.setVolume(Math.round((isMuted ? 0 : volume) * 100));
    } catch (e) {}
  }, [volume, isMuted]);

  // ── High-Precision 50ms Progress Ticker (Crucial for Smooth Synced Lyrics) ─
  useEffect(() => {
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (p && readyRef.current) {
        try {
          const state = p.getPlayerState?.();
          if (state === window.YT?.PlayerState?.PLAYING || state === window.YT?.PlayerState?.BUFFERING) {
            const t = p.getCurrentTime?.() || 0;
            if (t >= 0) setProgress(t);
            const dur = p.getDuration?.() || 0;
            if (dur > 0 && usePlayerStore.getState().duration !== dur) {
              usePlayerStore.getState().setDuration(dur);
            }
          }
        } catch (e) {}
      }
    }, 50);

    return () => clearInterval(interval);
  }, [setProgress]);

  // ── MediaSession Lock Screen Sync ─────────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || "NightWave Track",
        artist: currentTrack.artist || "NightWave",
        album: "NightWave Music",
        artwork: [
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "96x96",   type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "192x192", type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      const store = usePlayerStore.getState();
      navigator.mediaSession.setActionHandler("play", () => store.setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => store.setIsPlaying(false));
      navigator.mediaSession.setActionHandler("previoustrack", () => store.prev());
      navigator.mediaSession.setActionHandler("nexttrack", () => store.next());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          if (playerRef.current && readyRef.current) {
            playerRef.current.seekTo(details.seekTime, true);
            store.setProgress(details.seekTime);
          }
        }
      });
    } catch (e) {}
  }, [currentTrack, isPlaying]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const seek = useCallback((seconds) => {
    const p = playerRef.current;
    if (p && readyRef.current) {
      try {
        p.seekTo(seconds, true);
        setProgress(seconds);
      } catch (e) {}
    }
  }, [setProgress]);

  return { analyser: analyserRef, seek };
}
