/**
 * useAudioEngine — Ultra-Fast Playback Engine with Perfect Synced Lyrics & Status Bar
 *
 * Designed for instant 0ms track startup, reliable 50ms progress tracking,
 * smooth lyrics scrolling, and full seekbar synchronization.
 */
import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import usePlayerStore from "../store/usePlayerStore";
import { getAudioStreamUrl } from "../lib/api";

const IS_NATIVE = Capacitor.isNativePlatform();

// ── Load YouTube IFrame API once ──────────────────────────────────────────────
function loadYTScript() {
  if (window.YT || document.getElementById("yt-iframe-api")) return;
  const tag = document.createElement("script");
  tag.id = "yt-iframe-api";
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

export function useAudioEngine() {
  const analyserRef = useRef(null);

  if (IS_NATIVE) {
    return useNativeAudioEngine(analyserRef);
  } else {
    return useYouTubeEngine(analyserRef);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PC / BROWSER ENGINE — High-Performance YouTube IFrame Engine
// ═══════════════════════════════════════════════════════════════════════════════
function useYouTubeEngine(analyserRef) {
  const playerRef      = useRef(null);
  const readyRef       = useRef(false);
  const pendingIdRef   = useRef(null);
  const wakeLockRef    = useRef(null);

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

  // ── Screen Wake Lock (prevents monitor sleep while playing) ────────────────
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

  // ── Initialize YouTube IFrame ─────────────────────────────────────────────
  useEffect(() => {
    // 1px visible container (NOT opacity:0 / z-index:-9999 so Chrome does not throttle audio)
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
              player.loadVideoById({ videoId: vid, startSeconds: 0 });
              try { player.playVideo(); } catch (_) {}
            }
          },
          onStateChange: (e) => {
            // Numeric states: 1 = PLAYING, 2 = PAUSED, 3 = BUFFERING, 0 = ENDED
            if (e.data === 1) {
              usePlayerStore.getState().setIsPlaying(true);
              const dur = player.getDuration?.() || 0;
              if (dur > 0) usePlayerStore.getState().setDuration(dur);
            } else if (e.data === 2) {
              usePlayerStore.getState().setIsPlaying(false);
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
      // Backup poller in case onYouTubeIframeAPIReady already fired
      const pollInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(pollInterval);
          tryInitPlayer();
        }
      }, 100);
      setTimeout(() => clearInterval(pollInterval), 10000);
    }
  }, []);

  // ── Instant Song Startup on streamUrl change ───────────────────────────────
  useEffect(() => {
    if (!streamUrl) return;
    const videoId = streamUrl;

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
  }, [streamUrl]);

  // ── Play / Pause Sync ──────────────────────────────────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;

    if (isPlaying) {
      try { p.playVideo(); } catch (_) {}
      requestWakeLock();
    } else {
      try { p.pauseVideo(); } catch (_) {}
      releaseWakeLock();
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  // ── Volume Control ────────────────────────────────────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      p.setVolume(Math.round((isMuted ? 0 : volume) * 100));
    } catch (_) {}
  }, [volume, isMuted]);

  // ── High-Precision 50ms Progress Ticker (Updates Status Bar & Lyrics) ─────
  useEffect(() => {
    const interval = setInterval(() => {
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
    }, 50);

    return () => clearInterval(interval);
  }, [setProgress]);

  // ── MediaSession (PC Keyboard & Media Keys) ───────────────────────────────
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
        if (details.seekTime != null && playerRef.current && readyRef.current) {
          playerRef.current.seekTo(details.seekTime, true);
          store.setProgress(details.seekTime);
        }
      });
    } catch (_) {}
  }, [currentTrack, isPlaying]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const seek = useCallback((seconds) => {
    const p = playerRef.current;
    if (p && readyRef.current) {
      try {
        p.seekTo(seconds, true);
        setProgress(seconds);
      } catch (_) {}
    }
  }, [setProgress]);

  return { analyser: analyserRef, seek };
}


// ═══════════════════════════════════════════════════════════════════════════════
// NATIVE ENGINE — Native HTML <audio> (Android / iOS only)
// ═══════════════════════════════════════════════════════════════════════════════
function useNativeAudioEngine(analyserRef) {
  const audioRef = useRef(null);
  const loadedIdRef = useRef(null);

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

  useEffect(() => {
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
    audioRef.current = audio;

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

  useEffect(() => {
    if (!streamUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    const videoId = streamUrl;
    if (loadedIdRef.current === videoId) {
      audio.play().catch(() => {});
      return;
    }

    loadedIdRef.current = videoId;
    audio.src = getAudioStreamUrl(videoId);
    audio.load();
    audio.play().catch(() => {});
  }, [streamUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
  }, [volume, isMuted]);

  useEffect(() => {
    const interval = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      const t = audio.currentTime;
      if (t >= 0) setProgress(t);
    }, 50);
    return () => clearInterval(interval);
  }, [setProgress]);

  const seek = useCallback((seconds) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(0, seconds);
      usePlayerStore.getState().setProgress(Math.max(0, seconds));
    }
  }, []);

  return { analyser: analyserRef, seek };
}
