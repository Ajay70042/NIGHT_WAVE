/**
 * useAudioEngine — YouTube IFrame Player API with Robust Mobile Background Audio Anchor
 *
 * Background Playback on Mobile (iOS & Android):
 * - Mobile OSes pause video elements/iframes when off-screen or in the background
 *   unless an active HTML5 audio session is running.
 * - We generate a valid 2-second PCM WAV silent audio Blob in-memory and keep it
 *   looping on an HTMLAudioElement whenever music is playing.
 * - This anchors the OS-level Audio Session (iOS AVAudioSession / Android AudioFocus),
 *   allowing YouTube audio to continue playing uninterrupted in the background & lock screen.
 * - Includes Screen Wake Lock API management for foreground lyrics/visualizer enjoyment.
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

/**
 * Generates a valid 2-second 8000Hz 16-bit Mono PCM Silent WAV Blob URL.
 * Produces real WAV headers + zeroed PCM sample frames so mobile hardware
 * audio engines register an active, non-empty audio session.
 */
let cachedSilentBlobUrl = null;
function getSilentAudioBlobUrl() {
  if (cachedSilentBlobUrl) return cachedSilentBlobUrl;
  try {
    const sampleRate = 8000;
    const numSamples = sampleRate * 2; // 2 seconds
    const dataSize = numSamples * 2;   // 16-bit = 2 bytes/sample
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + dataSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt sub-chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);          // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true);           // AudioFormat (1 = PCM)
    view.setUint16(22, 1, true);           // NumChannels (1 = Mono)
    view.setUint32(24, sampleRate, true);  // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true);           // BlockAlign
    view.setUint16(34, 16, true);          // BitsPerSample

    // data sub-chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    // Remaining bytes are initialized to 0 (pure silence)
    const blob = new Blob([buffer], { type: "audio/wav" });
    cachedSilentBlobUrl = URL.createObjectURL(blob);
    return cachedSilentBlobUrl;
  } catch (e) {
    console.warn("Failed to generate silent WAV blob, falling back to minimal URI", e);
    return "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
  }
}

export function useAudioEngine() {
  const playerRef          = useRef(null);   // YT.Player instance
  const containerRef       = useRef(null);   // in-viewport container for iframe
  const silentAudioRef     = useRef(null);   // silent audio element to anchor OS background audio session
  const wakeLockRef        = useRef(null);   // Screen Wake Lock handle
  const analyserRef        = useRef(null);   // Visualizer simulated ref
  const readyRef           = useRef(false);
  const pendingIdRef       = useRef(null);   // videoId to load when player is ready
  const switchingTrackRef  = useRef(false);  // prevents transient unload PAUSE from stopping playback
  const intendedPlayingRef = useRef(false);  // tracks explicit user intent
  const switchTimeoutRef   = useRef(null);

  const {
    streamUrl,
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
      } catch (_) {
        // WakeLock may be rejected due to battery saver or background state
      }
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

  // ── Create in-viewport iframe container + silent audio in DOM ──────────────
  useEffect(() => {
    // 1. YouTube Iframe container:
    // Must be in active viewport with tiny opacity (0.001) instead of off-screen (-9999px)
    // so mobile browsers do not freeze the media renderer when backgrounded.
    let div = document.getElementById("yt-player-container");
    if (!div) {
      div = document.createElement("div");
      div.id = "yt-player-container";
      div.style.cssText =
        "position:fixed;top:0;left:0;width:200px;height:200px;opacity:0.001;pointer-events:none;z-index:-9999;overflow:hidden;";
      document.body.appendChild(div);
    }
    containerRef.current = div;

    // 2. Silent audio anchor for mobile background playback session
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

    // 3. One-time gesture listener to unlock audio permissions on first mobile touch
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

    // 4. Initialize player when API is ready
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
          playsinline:    1, // CRITICAL FOR MOBILE IOS & ANDROID INLINE PLAYBACK
          origin:         window.location.origin,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            player.setVolume(Math.round(
              (usePlayerStore.getState().isMuted ? 0 : usePlayerStore.getState().volume) * 100
            ));
            // Load any track queued before player was ready
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
              // If we are currently transitioning to a new track, ignore transient unload PAUSE
              if (switchingTrackRef.current) {
                try { player.playVideo(); } catch (_) {}
                return;
              }
              // If paused automatically due to app backgrounding / locking screen, keep playing!
              if (intendedPlayingRef.current && (document.visibilityState === "hidden" || !document.hasFocus())) {
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
            // On unplayable video (e.g. embed disabled 101/150 or not found 100), auto-skip immediately
            if (e.data === 101 || e.data === 150 || e.data === 100 || e.data === 2) {
              console.warn("Track cannot be played/embedded, auto-skipping to next...");
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

  // ── Load new video when streamUrl (videoId) changes ───────────────────────
  useEffect(() => {
    if (!streamUrl) return;
    const videoId = streamUrl;

    intendedPlayingRef.current = true;
    switchingTrackRef.current = true;

    // Anchor background audio session immediately
    const audio = silentAudioRef.current;
    if (audio) {
      audio.play().catch(() => {});
    }

    if (switchTimeoutRef.current) clearTimeout(switchTimeoutRef.current);
    switchTimeoutRef.current = setTimeout(() => {
      switchingTrackRef.current = false;
    }, 2500);

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

  // ── Sync play/pause from Zustand + trigger mobile background audio session ─
  useEffect(() => {
    intendedPlayingRef.current = isPlaying;
    const p = playerRef.current;
    const audio = silentAudioRef.current;

    if (isPlaying) {
      // Start silent audio anchor to keep OS background audio session active
      if (audio) {
        audio.play().catch(() => {});
      }
      if (p && readyRef.current && !switchingTrackRef.current) {
        try { p.playVideo(); } catch (e) { /* ignore */ }
      }
      requestWakeLock();
    } else {
      if (audio) {
        audio.pause();
      }
      if (p && readyRef.current && !switchingTrackRef.current) {
        try { p.pauseVideo(); } catch (e) { /* ignore */ }
      }
      releaseWakeLock();
    }
  }, [isPlaying, requestWakeLock, releaseWakeLock]);

  // ── Maintain background playback on app minimize / screen lock ───────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      const p = playerRef.current;
      const audio = silentAudioRef.current;
      if (intendedPlayingRef.current) {
        if (audio) audio.play().catch(() => {});
        if (p && readyRef.current) {
          try { p.playVideo(); } catch (_) {}
        }
        if (document.visibilityState === "visible") {
          requestWakeLock();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleVisibilityChange);
    window.addEventListener("blur", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleVisibilityChange);
      window.removeEventListener("blur", handleVisibilityChange);
    };
  }, [requestWakeLock]);

  // ── Volume ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      p.setVolume(Math.round((isMuted ? 0 : volume) * 100));
    } catch (e) { /* ignore */ }
  }, [volume, isMuted]);

  // ── Progress ticker (50ms high-precision updates for word-level sync) ─────
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
        } catch (e) { /* ignore */ }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [setProgress]);

  // ── Seek ──────────────────────────────────────────────────────────────────
  const seek = useCallback((seconds) => {
    const p = playerRef.current;
    if (p && readyRef.current) {
      try {
        p.seekTo(seconds, true);
        setProgress(seconds);
      } catch (e) { /* ignore */ }
    }
  }, [setProgress]);

  return { analyser: analyserRef, seek };
}

