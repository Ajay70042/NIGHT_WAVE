/**
 * useAudioEngine — Unified Audio Playback Engine
 *
 * Guaranteed 100% React Hooks compliant (no conditional hook branching).
 * Handles instant track startup, 50ms progress ticker, lyrics sync, and lock screen media keys.
 */
import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import usePlayerStore from "../store/usePlayerStore";
import { getAudioStreamUrl } from "../lib/api";

const IS_NATIVE = Capacitor.isNativePlatform();

// ── Load YouTube IFrame API once ──────────────────────────────────────────────
function loadYTScript() {
  if (typeof window === "undefined") return;
  if (window.YT || document.getElementById("yt-iframe-api")) return;
  const tag = document.createElement("script");
  tag.id = "yt-iframe-api";
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

export function useAudioEngine() {
  const analyserRef     = useRef(null);
  const playerRef       = useRef(null);
  const readyRef        = useRef(false);
  const pendingIdRef    = useRef(null);
  const wakeLockRef     = useRef(null);
  const nativeAudioRef  = useRef(null);
  const loadedIdRef     = useRef(null);
  const lastLoadTimeRef = useRef(0);

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

  const playTimestamp = usePlayerStore((s) => s.playTimestamp);

  // ── Screen Wake Lock ────────────────────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator && !wakeLockRef.current && document.visibilityState === "visible") {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
      } catch (_) {}
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try { await wakeLockRef.current.release(); } catch (_) {}
      wakeLockRef.current = null;
    }
  }, []);

  // ── 1. Native Audio Setup (Android/iOS only) ────────────────────────────────
  useEffect(() => {
    if (!IS_NATIVE) return;

    let audio = document.getElementById("nightwave-native-audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "nightwave-native-audio";
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.crossOrigin = "anonymous";
      audio.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(audio);
    }
    nativeAudioRef.current = audio;

    const onDuration = () => {
      if (audio.duration && isFinite(audio.duration)) {
        usePlayerStore.getState().setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      const rm = usePlayerStore.getState().repeatMode;
      if (rm === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        usePlayerStore.getState().next();
      }
    };
    const onPlay = () => usePlayerStore.getState().setIsPlaying(true);
    const onPause = () => usePlayerStore.getState().setIsPlaying(false);

    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  // ── 2. YouTube IFrame Player Setup (PC / Web) ──────────────────────────────
  useEffect(() => {
    if (IS_NATIVE) return;

    let container = document.getElementById("yt-player-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "yt-player-container";
      container.style.cssText =
        "position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:1;pointer-events:none;z-index:-1;overflow:hidden;";
      document.body.appendChild(container);
    }

    loadYTScript();

    const tryInitPlayer = () => {
      if (playerRef.current) return;
      if (!window.YT || !window.YT.Player) return;

      const player = new window.YT.Player("yt-player-container", {
        width: "1",
        height: "1",
        videoId: "",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          enablejsapi: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
          widget_referrer: window.location.href,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            playerRef.current = player;
            player.setVolume(Math.round(
              (usePlayerStore.getState().isMuted ? 0 : usePlayerStore.getState().volume) * 100
            ));

            if (pendingIdRef.current) {
              const vid = pendingIdRef.current;
              pendingIdRef.current = null;
              lastLoadTimeRef.current = Date.now();
              player.loadVideoById({ videoId: vid, startSeconds: 0 });
              try { player.playVideo(); } catch (_) {}
            }
          },
          onStateChange: (e) => {
            // Numeric states: 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 0 = ENDED, 5 = CUED, -1 = UNSTARTED
            if (e.data === 1) {
              usePlayerStore.getState().setIsPlaying(true);
              const dur = player.getDuration?.() || 0;
              if (dur > 0) usePlayerStore.getState().setDuration(dur);
            } else if (e.data === 2) {
              // Ignore temporary PAUSED event emitted by YouTube when unloading the previous video during track change
              if (Date.now() - lastLoadTimeRef.current < 2500 && usePlayerStore.getState().isPlaying) {
                try { player.playVideo(); } catch (_) {}
                return;
              }
              usePlayerStore.getState().setIsPlaying(false);
            } else if (e.data === 3 || e.data === 5 || e.data === -1) {
              if (usePlayerStore.getState().isPlaying) {
                try { player.playVideo(); } catch (_) {}
              }
            } else if (e.data === 0) {
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
            console.warn("YouTube player error code:", e.data);
            if (e.data === 101 || e.data === 150 || e.data === 100 || e.data === 2 || e.data === 5) {
              setTimeout(() => usePlayerStore.getState().next(), 400);
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      tryInitPlayer();
    } else {
      window.onYouTubeIframeAPIReady = tryInitPlayer;
      const pollInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(pollInterval);
          tryInitPlayer();
        }
      }, 100);
      setTimeout(() => clearInterval(pollInterval), 10000);
    }
  }, []);

  // ── 3. Load & Play Track on Selection ───────────────────────────────────────
  useEffect(() => {
    if (!streamUrl) return;
    const videoId = streamUrl;
    lastLoadTimeRef.current = Date.now();

    if (IS_NATIVE) {
      const audio = nativeAudioRef.current;
      if (!audio) return;
      if (loadedIdRef.current === videoId) {
        audio.play().catch(() => {});
        return;
      }
      loadedIdRef.current = videoId;
      audio.src = getAudioStreamUrl(videoId);
      audio.load();
      audio.play().catch(() => {});
    } else {
      if (!readyRef.current || !playerRef.current) {
        pendingIdRef.current = videoId;
        return;
      }
      try {
        playerRef.current.loadVideoById({ videoId, startSeconds: 0 });
        playerRef.current.playVideo();
        usePlayerStore.getState().setIsPlaying(true);
      } catch (e) {
        console.warn("loadVideoById error:", e);
      }
    }
  }, [streamUrl, playTimestamp]);

  // ── 4. Play / Pause Synchronization ───────────────────────────────────────
  useEffect(() => {
    if (IS_NATIVE) {
      const audio = nativeAudioRef.current;
      if (!audio) return;
      if (isPlaying) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    } else {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      if (isPlaying) {
        try { p.playVideo(); } catch (_) {}
        requestWakeLock();
      } else {
        try { p.pauseVideo(); } catch (_) {}
        releaseWakeLock();
      }
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  // ── 5. Volume Control ─────────────────────────────────────────────────────
  useEffect(() => {
    if (IS_NATIVE) {
      const audio = nativeAudioRef.current;
      if (!audio) return;
      audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
    } else {
      const p = playerRef.current;
      if (!p || !readyRef.current) return;
      try {
        p.setVolume(Math.round((isMuted ? 0 : volume) * 100));
      } catch (_) {}
    }
  }, [volume, isMuted]);

  // ── 6. 50ms High-Precision Progress Ticker ────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (IS_NATIVE) {
        const audio = nativeAudioRef.current;
        if (!audio || audio.paused) return;
        const t = audio.currentTime;
        if (t >= 0) setProgress(t);
      } else {
        const p = playerRef.current;
        if (!p || !readyRef.current) return;
        try {
          const t = p.getCurrentTime?.();
          if (typeof t === "number" && !isNaN(t) && t >= 0) {
            setProgress(t);
          }
          const dur = p.getDuration?.();
          if (typeof dur === "number" && !isNaN(dur) && dur > 0) {
            if (usePlayerStore.getState().duration !== dur) {
              usePlayerStore.getState().setDuration(dur);
            }
          }
        } catch (_) {}
      }
    }, 50);

    return () => clearInterval(interval);
  }, [setProgress]);

  // ── 7. MediaSession Keys ──────────────────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || "NightWave",
        artist: currentTrack.artist || "NightWave Music",
        album: "NightWave",
        artwork: [
          { src: currentTrack.thumbnail || "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      const store = usePlayerStore.getState();
      const safeSet = (a, h) => { try { navigator.mediaSession.setActionHandler(a, h); } catch (_) {} };

      safeSet("play", () => store.setIsPlaying(true));
      safeSet("pause", () => store.setIsPlaying(false));
      safeSet("previoustrack", () => store.previous());
      safeSet("nexttrack", () => store.next());
      safeSet("stop", () => store.setIsPlaying(false));
      safeSet("seekto", (details) => {
        if (details.seekTime != null) {
          if (IS_NATIVE && nativeAudioRef.current) {
            nativeAudioRef.current.currentTime = details.seekTime;
          } else if (playerRef.current && readyRef.current) {
            playerRef.current.seekTo(details.seekTime, true);
          }
          store.setProgress(details.seekTime);
        }
      });
    } catch (_) {}
  }, [currentTrack, isPlaying]);

  // ── 8. Seek Callback ──────────────────────────────────────────────────────
  const seek = useCallback((seconds) => {
    if (IS_NATIVE) {
      const audio = nativeAudioRef.current;
      if (audio) {
        audio.currentTime = Math.max(0, seconds);
        usePlayerStore.getState().setProgress(Math.max(0, seconds));
      }
    } else {
      const p = playerRef.current;
      if (p && readyRef.current) {
        try {
          p.seekTo(seconds, true);
          setProgress(seconds);
        } catch (_) {}
      }
    }
  }, [setProgress]);

  return { analyser: analyserRef, seek };
}
