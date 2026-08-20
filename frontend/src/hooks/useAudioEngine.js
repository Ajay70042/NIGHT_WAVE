/**
 * useAudioEngine — Dual-Engine Audio Playback
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  NATIVE (Android/iOS Capacitor)                                 │
 * │   → Native HTML <audio> element                                 │
 * │   → Streams from /api/stream/audio?id= (backend proxy)         │
 * │   → Plays in BACKGROUND + LOCK SCREEN — 100% real music        │
 * │   → MediaSession lock screen controls fully wired               │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  BROWSER (PC / Web)                                             │
 * │   → YouTube IFrame API (unchanged, no regression)              │
 * │   → Instant 0ms startup, full YT library access                │
 * │   → 50ms high-precision progress for synced lyrics             │
 * └─────────────────────────────────────────────────────────────────┘
 */
import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import usePlayerStore from "../store/usePlayerStore";
import { getAudioStreamUrl } from "../lib/api";

const IS_NATIVE = Capacitor.isNativePlatform();

// ─── Utility: load YouTube IFrame API once ────────────────────────────────────
function loadYTScript() {
  if (window.YT || document.getElementById("yt-iframe-api")) return;
  const tag = document.createElement("script");
  tag.id = "yt-iframe-api";
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

// ─── Utility: 2-sec silent WAV blob (anchors audio hardware session) ──────────
let cachedSilentBlobUrl = null;
function getSilentAudioBlobUrl() {
  if (cachedSilentBlobUrl) return cachedSilentBlobUrl;
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate * 2;
    const dataSize = numSamples * 2;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    view.setUint32(0, 0x52494646, false);
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false);
    view.setUint32(12, 0x666d7420, false);
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, dataSize, true);
    const blob = new Blob([buffer], { type: "audio/wav" });
    cachedSilentBlobUrl = URL.createObjectURL(blob);
    return cachedSilentBlobUrl;
  } catch {
    return "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
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
// NATIVE ENGINE — HTML <audio> element → real background/lock screen play
// ═══════════════════════════════════════════════════════════════════════════════
function useNativeAudioEngine(analyserRef) {
  const audioRef        = useRef(null);  // <audio> element
  const loadedIdRef     = useRef(null);  // currently loaded videoId
  const intendedPlay    = useRef(false);
  const progressTimerRef = useRef(null);

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

  // ── Create/get the <audio> element once ────────────────────────────────────
  useEffect(() => {
    let audio = document.getElementById("nightwave-native-audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "nightwave-native-audio";
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      audio.crossOrigin = "anonymous";
      audio.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;";
      document.body.appendChild(audio);
    }
    audioRef.current = audio;

    // Wire permanent event listeners
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
    const onError = (e) => {
      console.error("Native audio error:", audio.error);
      // Try next track on fatal errors
      setTimeout(() => usePlayerStore.getState().next(), 800);
    };
    const onPlay  = () => usePlayerStore.getState().setIsPlaying(true);
    const onPause = () => {
      if (intendedPlay.current) {
        // Android OS paused us — try to resume (happens on audio focus loss)
        audio.play().catch(() => {});
      } else {
        usePlayerStore.getState().setIsPlaying(false);
      }
    };
    const onCanPlay = () => {
      usePlayerStore.getState().setIsPlaying(true); // signal loading done
    };

    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load new track when streamUrl changes ──────────────────────────────────
  useEffect(() => {
    if (!streamUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    const videoId = streamUrl;
    if (loadedIdRef.current === videoId) {
      // Same track — just play
      intendedPlay.current = true;
      audio.play().catch(() => {});
      return;
    }

    loadedIdRef.current = videoId;
    intendedPlay.current = true;

    // Load the backend proxy URL (plays as real audio — works in background!)
    const url = getAudioStreamUrl(videoId);
    audio.src = url;
    audio.load();
    audio.play().catch((err) => {
      console.warn("Native audio play failed:", err);
      // On gesture requirement error, the canplay event will retry
    });
  }, [streamUrl]);

  // ── Play / Pause control ───────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    intendedPlay.current = isPlaying;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // ── Volume ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = isMuted ? 0 : Math.max(0, Math.min(1, volume));
  }, [volume, isMuted]);

  // ── High-precision progress ticker (50ms) ─────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;
      const t = audio.currentTime;
      if (t >= 0) setProgress(t);
    }, 50);
    progressTimerRef.current = id;
    return () => clearInterval(id);
  }, [setProgress]);

  // ── MediaSession — Lock Screen Controls ───────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  currentTrack.title  || "NightWave Track",
        artist: currentTrack.artist || "NightWave",
        album:  "NightWave Music",
        artwork: [
          { src: currentTrack.thumbnail || "/icon-192.png", sizes: "96x96",   type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      const store = usePlayerStore.getState();
      const safeSet = (a, h) => { try { navigator.mediaSession.setActionHandler(a, h); } catch (_) {} };

      safeSet("play",          () => { store.setIsPlaying(true);  });
      safeSet("pause",         () => { store.setIsPlaying(false); });
      safeSet("previoustrack", () => store.previous());
      safeSet("nexttrack",     () => store.next());
      safeSet("stop",          () => { store.setIsPlaying(false); });
      safeSet("seekto", (details) => {
        if (details.seekTime != null) {
          const audio = audioRef.current;
          if (audio) {
            audio.currentTime = details.seekTime;
            store.setProgress(details.seekTime);
          }
        }
      });
      safeSet("seekbackward", (details) => {
        const audio = audioRef.current;
        if (audio) audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));
      });
      safeSet("seekforward", (details) => {
        const audio = audioRef.current;
        if (audio) audio.currentTime = Math.min(audio.duration || 9999, audio.currentTime + (details.seekOffset || 10));
      });
    } catch (e) {}
  }, [currentTrack, isPlaying]);

  // ── Sync position state with lock screen seekbar ───────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !("setPositionState" in navigator.mediaSession)) return;
    const store = usePlayerStore.getState();
    const dur = store.duration;
    const pos = store.progress;
    if (dur > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0.1, dur),
          playbackRate: 1.0,
          position: Math.min(Math.max(0, pos), dur),
        });
      } catch (_) {}
    }
  });

  // ── Seek ──────────────────────────────────────────────────────────────────
  const seek = useCallback((seconds) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(0, seconds);
      usePlayerStore.getState().setProgress(Math.max(0, seconds));
    }
  }, []);

  return { analyser: analyserRef, seek };
}


// ═══════════════════════════════════════════════════════════════════════════════
// BROWSER ENGINE — YouTube IFrame API (PC / Web — unchanged behavior)
// ═══════════════════════════════════════════════════════════════════════════════
function useYouTubeEngine(analyserRef) {
  const playerRef          = useRef(null);
  const containerRef       = useRef(null);
  const silentAudioRef     = useRef(null);
  const wakeLockRef        = useRef(null);
  const readyRef           = useRef(false);
  const pendingIdRef       = useRef(null);
  const switchingTrackRef  = useRef(false);
  const intendedPlayingRef = useRef(false);
  const switchTimeoutRef   = useRef(null);
  const loadingTimerRef    = useRef(null);

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

  // ── Screen Wake Lock ───────────────────────────────────────────────────────
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

  // ── Init YT Player + Silent Audio ─────────────────────────────────────────
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
          if (!usePlayerStore.getState().isPlaying) audio.pause();
        }).catch(() => {});
      }
      window.removeEventListener("touchstart",  primeAudioGesture);
      window.removeEventListener("pointerdown", primeAudioGesture);
      window.removeEventListener("click",       primeAudioGesture);
    };
    window.addEventListener("touchstart",  primeAudioGesture, { passive: true });
    window.addEventListener("pointerdown", primeAudioGesture, { passive: true });
    window.addEventListener("click",       primeAudioGesture, { passive: true });

    loadYTScript();

    const initPlayer = () => {
      if (playerRef.current) return;
      const player = new window.YT.Player(div, {
        width:   "200",
        height:  "200",
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
              switchingTrackRef.current  = true;
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
              // Clear any stuck loading timer
              if (loadingTimerRef.current) {
                clearTimeout(loadingTimerRef.current);
                loadingTimerRef.current = null;
              }
              usePlayerStore.getState().setIsPlaying(true);
              const dur = player.getDuration?.() || 0;
              if (dur > 0) usePlayerStore.getState().setDuration(dur);
            } else if (e.data === YT.BUFFERING) {
              if (intendedPlayingRef.current) {
                usePlayerStore.getState().setIsPlaying(true);
              }
              // Safety net: if buffering for > 12s, skip to next
              if (!loadingTimerRef.current) {
                loadingTimerRef.current = setTimeout(() => {
                  loadingTimerRef.current = null;
                  if (usePlayerStore.getState().isLoading) {
                    usePlayerStore.getState().next();
                  }
                }, 12000);
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
            if (loadingTimerRef.current) { clearTimeout(loadingTimerRef.current); loadingTimerRef.current = null; }
            if (e.data === 101 || e.data === 150 || e.data === 100 || e.data === 2 || e.data === 5) {
              setTimeout(() => usePlayerStore.getState().next(), 300);
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
      window.removeEventListener("touchstart",  primeAudioGesture);
      window.removeEventListener("pointerdown", primeAudioGesture);
      window.removeEventListener("click",       primeAudioGesture);
    };
  }, []);

  // ── Load new video when streamUrl changes ──────────────────────────────────
  useEffect(() => {
    if (!streamUrl) return;
    const videoId = streamUrl;

    intendedPlayingRef.current = true;
    switchingTrackRef.current  = true;

    const audio = silentAudioRef.current;
    if (audio) audio.play().catch(() => {});

    if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
    switchTimeoutRef.current = setTimeout(() => { switchingTrackRef.current = false; }, 3000);

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

  // ── Sync play/pause ────────────────────────────────────────────────────────
  useEffect(() => {
    intendedPlayingRef.current = isPlaying;
    const p     = playerRef.current;
    const audio = silentAudioRef.current;

    if (isPlaying) {
      if (audio) audio.play().catch(() => {});
      if (p && readyRef.current && !switchingTrackRef.current) {
        try { p.playVideo(); } catch (_) {}
      }
      requestWakeLock();
    } else {
      if (audio) audio.pause();
      if (p && readyRef.current && !switchingTrackRef.current) {
        try { p.pauseVideo(); } catch (_) {}
      }
      releaseWakeLock();
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  // ── Volume ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try { p.setVolume(Math.round((isMuted ? 0 : volume) * 100)); } catch (_) {}
  }, [volume, isMuted]);

  // ── High-Precision 50ms Progress Ticker ───────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (p && readyRef.current) {
        try {
          const state = p.getPlayerState?.();
          if (state === window.YT?.PlayerState?.PLAYING) {
            const t = p.getCurrentTime?.() || 0;
            if (t >= 0) setProgress(t);
            const dur = p.getDuration?.() || 0;
            if (dur > 0 && usePlayerStore.getState().duration !== dur) {
              usePlayerStore.getState().setDuration(dur);
            }
          }
        } catch (_) {}
      }
    }, 50);
    return () => clearInterval(interval);
  }, [setProgress]);

  // ── MediaSession (PC lock screen) ─────────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  currentTrack.title  || "NightWave Track",
        artist: currentTrack.artist || "NightWave",
        album:  "NightWave Music",
        artwork: [
          { src: currentTrack.thumbnail || "/icon-192.png", sizes: "96x96",   type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      const store = usePlayerStore.getState();
      const safeSet = (a, h) => { try { navigator.mediaSession.setActionHandler(a, h); } catch (_) {} };

      safeSet("play",          () => store.setIsPlaying(true));
      safeSet("pause",         () => store.setIsPlaying(false));
      safeSet("previoustrack", () => store.previous());
      safeSet("nexttrack",     () => store.next());
      safeSet("stop",          () => store.setIsPlaying(false));
      safeSet("seekto", (details) => {
        if (details.seekTime != null && playerRef.current && readyRef.current) {
          playerRef.current.seekTo(details.seekTime, true);
          store.setProgress(details.seekTime);
        }
      });
      safeSet("seekbackward", (details) => {
        if (playerRef.current && readyRef.current) {
          const t = Math.max(0, (playerRef.current.getCurrentTime?.() || 0) - (details.seekOffset || 10));
          playerRef.current.seekTo(t, true);
          store.setProgress(t);
        }
      });
      safeSet("seekforward", (details) => {
        if (playerRef.current && readyRef.current) {
          const t = (playerRef.current.getCurrentTime?.() || 0) + (details.seekOffset || 10);
          playerRef.current.seekTo(t, true);
          store.setProgress(t);
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
