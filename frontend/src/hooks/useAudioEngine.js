/**
 * useAudioEngine — High-Performance Native HTML5 Audio Engine with YouTube Fallback
 *
 * Background & Lock Screen Playback on Mobile (Android & iOS):
 * - Plays direct high-quality audio streams (.m4a/.webm) natively via HTMLAudioElement (<audio>).
 * - Because it is a pure native audio stream (not a video iframe), mobile OSes (iOS AVAudioSession / Android AudioFocus)
 *   and lock screen media widgets NEVER pause playback when the screen is locked, turned off, or apps are switched.
 * - Integrates with MediaSession API for full lock screen controls (artwork, scrubber, play/pause, next/prev).
 * - Automatic YouTube IFrame fallback if direct stream extraction is unavailable.
 */
import { useEffect, useRef, useCallback } from "react";
import usePlayerStore from "../store/usePlayerStore";
import { resolveStream, getAudioStreamUrl } from "../lib/api";

export function useAudioEngine() {
  const audioRef           = useRef(null);   // HTMLAudioElement for direct native audio
  const ytPlayerRef        = useRef(null);   // YT.Player fallback
  const ytContainerRef     = useRef(null);   // YT container
  const activeEngineRef    = useRef("audio");// "audio" | "yt"
  const wakeLockRef        = useRef(null);   // Screen Wake Lock
  const analyserRef        = useRef(null);   // Visualizer ref
  const ytReadyRef         = useRef(false);
  const currentVideoIdRef  = useRef(null);
  const abortControllerRef = useRef(null);

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

  // ── Screen Wake Lock Manager (when app is visible) ────────────────────────
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

  // ── Initialize Native HTML5 Audio Element + YouTube Fallback ──────────────
  useEffect(() => {
    // 1. Create or get primary HTMLAudioElement
    let audio = document.getElementById("nightwave-native-audio");
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = "nightwave-native-audio";
      audio.preload = "auto";
      audio.setAttribute("playsinline", "true");
      audio.setAttribute("webkit-playsinline", "true");
      document.body.appendChild(audio);
    }
    audioRef.current = audio;

    // Audio element event listeners
    const onTimeUpdate = () => {
      if (activeEngineRef.current === "audio" && audio.currentTime >= 0) {
        setProgress(audio.currentTime);
      }
    };

    const onDurationChange = () => {
      if (activeEngineRef.current === "audio" && audio.duration > 0 && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onPlay = () => {
      if (activeEngineRef.current === "audio") {
        setIsPlaying(true);
      }
    };

    const onPause = () => {
      if (activeEngineRef.current === "audio" && !audio.seeking && audio.currentTime < (audio.duration || 1) - 0.5) {
        setIsPlaying(false);
      }
    };

    const onEnded = () => {
      if (activeEngineRef.current === "audio") {
        const rm = usePlayerStore.getState().repeatMode;
        if (rm === "one") {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        } else {
          usePlayerStore.getState().next();
        }
      }
    };

    const onError = (e) => {
      console.warn("Native audio stream error, falling back to YouTube player:", e);
      if (currentVideoIdRef.current && activeEngineRef.current === "audio") {
        switchToYouTubeFallback(currentVideoIdRef.current);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("loadedmetadata", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    // 2. Fallback YouTube player setup
    let div = document.getElementById("yt-player-container");
    if (!div) {
      div = document.createElement("div");
      div.id = "yt-player-container";
      div.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0.001;pointer-events:none;z-index:-9999;";
      document.body.appendChild(div);
    }
    ytContainerRef.current = div;

    const initYT = () => {
      if (ytPlayerRef.current || !window.YT?.Player) return;
      ytPlayerRef.current = new window.YT.Player(div, {
        width: "1",
        height: "1",
        videoId: "",
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            ytReadyRef.current = true;
          },
          onStateChange: (e) => {
            if (activeEngineRef.current !== "yt") return;
            const YT = window.YT.PlayerState;
            if (e.data === YT.PLAYING) {
              setIsPlaying(true);
              const dur = ytPlayerRef.current?.getDuration?.() || 0;
              if (dur > 0) setDuration(dur);
            } else if (e.data === YT.PAUSED) {
              setIsPlaying(false);
            } else if (e.data === YT.ENDED) {
              const rm = usePlayerStore.getState().repeatMode;
              if (rm === "one") {
                ytPlayerRef.current?.seekTo(0);
                ytPlayerRef.current?.playVideo();
              } else {
                usePlayerStore.getState().next();
              }
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initYT();
    } else {
      if (!document.getElementById("yt-iframe-api")) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      window.onYouTubeIframeAPIReady = initYT;
    }

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("loadedmetadata", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [setProgress, setDuration, setIsPlaying]);

  // ── YouTube Fallback Switcher ─────────────────────────────────────────────
  const switchToYouTubeFallback = useCallback((videoId) => {
    activeEngineRef.current = "yt";
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    const yt = ytPlayerRef.current;
    if (yt && ytReadyRef.current) {
      try {
        yt.loadVideoById({ videoId, startSeconds: 0 });
        yt.playVideo();
      } catch (e) {
        console.error("YT fallback error:", e);
      }
    }
  }, []);

  // ── Play Track (Load Direct Audio Stream) ──────────────────────────────────
  useEffect(() => {
    if (!streamUrl) return;
    const videoId = streamUrl;
    currentVideoIdRef.current = videoId;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    const audio = audioRef.current;
    if (!audio) return;

    // Pause any active YouTube fallback player
    if (ytPlayerRef.current && ytReadyRef.current) {
      try { ytPlayerRef.current.pauseVideo(); } catch (_) {}
    }

    activeEngineRef.current = "audio";
    audio.volume = isMuted ? 0 : volume;

    // Attempt direct audio stream resolution
    resolveStream(videoId)
      .then((streamData) => {
        if (abortCtrl.signal.aborted) return;
        if (streamData && streamData.url) {
          audio.src = streamData.url;
          audio.play().catch((err) => {
            console.warn("Direct stream play failed, trying proxy audio stream...", err);
            audio.src = getAudioStreamUrl(videoId);
            audio.play().catch(() => switchToYouTubeFallback(videoId));
          });
        } else {
          audio.src = getAudioStreamUrl(videoId);
          audio.play().catch(() => switchToYouTubeFallback(videoId));
        }
      })
      .catch((err) => {
        if (abortCtrl.signal.aborted) return;
        console.warn("resolveStream failed, attempting /api/stream/audio proxy...", err);
        audio.src = getAudioStreamUrl(videoId);
        audio.play().catch(() => switchToYouTubeFallback(videoId));
      });

    requestWakeLock();
  }, [streamUrl, requestWakeLock, switchToYouTubeFallback]);

  // ── Sync Play / Pause State ───────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    const yt = ytPlayerRef.current;

    if (isPlaying) {
      if (activeEngineRef.current === "audio" && audio && audio.src) {
        audio.play().catch(() => {});
      } else if (activeEngineRef.current === "yt" && yt && ytReadyRef.current) {
        try { yt.playVideo(); } catch (_) {}
      }
      requestWakeLock();
    } else {
      if (activeEngineRef.current === "audio" && audio) {
        audio.pause();
      } else if (activeEngineRef.current === "yt" && yt && ytReadyRef.current) {
        try { yt.pauseVideo(); } catch (_) {}
      }
      releaseWakeLock();
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  // ── Volume & Mute Sync ───────────────────────────────────────────────────
  useEffect(() => {
    const effectiveVol = isMuted ? 0 : volume;
    if (audioRef.current) {
      audioRef.current.volume = effectiveVol;
    }
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.setVolume(Math.round(effectiveVol * 100));
      } catch (_) {}
    }
  }, [volume, isMuted]);

  // ── MediaSession Lock Screen Sync & Hardware Media Keys ───────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !currentTrack) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || "Unknown Title",
        artist: currentTrack.artist || "NightWave",
        album: "NightWave Music",
        artwork: [
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "96x96",   type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "128x128", type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "192x192", type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "256x256", type: "image/png" },
          { src: currentTrack.thumbnail || "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

      // Bind lock screen buttons
      const store = usePlayerStore.getState();
      navigator.mediaSession.setActionHandler("play", () => store.setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => store.setIsPlaying(false));
      navigator.mediaSession.setActionHandler("previoustrack", () => store.prev());
      navigator.mediaSession.setActionHandler("nexttrack", () => store.next());
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          if (activeEngineRef.current === "audio" && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            store.setProgress(details.seekTime);
          } else if (ytPlayerRef.current && ytReadyRef.current) {
            ytPlayerRef.current.seekTo(details.seekTime, true);
            store.setProgress(details.seekTime);
          }
        }
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const offset = details.seekOffset || 10;
        const currentPos = store.progress;
        const newPos = Math.max(0, currentPos - offset);
        if (activeEngineRef.current === "audio" && audioRef.current) {
          audioRef.current.currentTime = newPos;
        }
        store.setProgress(newPos);
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const offset = details.seekOffset || 10;
        const currentPos = store.progress;
        const newPos = Math.min(store.duration || currentPos + offset, currentPos + offset);
        if (activeEngineRef.current === "audio" && audioRef.current) {
          audioRef.current.currentTime = newPos;
        }
        store.setProgress(newPos);
      });
    } catch (e) {
      console.warn("MediaSession registration error:", e);
    }
  }, [currentTrack, isPlaying]);

  // ── Seek Callback ─────────────────────────────────────────────────────────
  const seek = useCallback((seconds) => {
    if (activeEngineRef.current === "audio" && audioRef.current) {
      audioRef.current.currentTime = seconds;
      setProgress(seconds);
    } else if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.seekTo(seconds, true);
        setProgress(seconds);
      } catch (_) {}
    }
  }, [setProgress]);

  return { analyser: analyserRef, seek };
}
