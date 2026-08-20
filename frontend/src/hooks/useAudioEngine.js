/**
 * useAudioEngine — YouTube IFrame Player API
 *
 * Why IFrame API?
 * - Direct googlevideo.com URLs fail (MEDIA_ERR_SRC_NOT_SUPPORTED) because
 *   the ANDROID_VR client token in the URL is rejected by browsers.
 * - Server-side proxy gets 403 (YouTube blocks non-browser TLS fingerprints).
 * - YouTube IFrame API is the ONLY officially supported way to play YouTube
 *   audio/video in a web app without API keys.
 *
 * The IFrame is hidden (0×0, muted visually) — we use the IFrame API's
 * internal audio engine while keeping our own UI controls synced via polling.
 *
 * Visualizer: The IFrame audio isn't accessible via Web Audio API due to
 * cross-origin restrictions, so we simulate the visualizer with a
 * CSS-driven animation tied to the playing state.
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

export function useAudioEngine() {
  const playerRef          = useRef(null);   // YT.Player instance
  const containerRef       = useRef(null);   // hidden div for iframe
  const analyserRef        = useRef(null);   // dummy — keeps Visualizer happy
  const readyRef           = useRef(false);
  const pendingIdRef       = useRef(null);   // videoId to load when player is ready
  const switchingTrackRef  = useRef(false);  // prevents transient unload PAUSE from stopping playback
  const intendedPlayingRef = useRef(false);  // tracks explicit user intent
  const switchTimeoutRef   = useRef(null);

  const {
    streamUrl,          // we repurpose this as videoId
    isPlaying,
    volume,
    isMuted,
    setProgress,
    setDuration,
    setIsPlaying,
    next,
    repeatMode,
  } = usePlayerStore();

  // ── Create hidden iframe container in DOM ─────────────────────────────────
  useEffect(() => {
    let div = document.getElementById("yt-player-container");
    if (!div) {
      div = document.createElement("div");
      div.id = "yt-player-container";
      div.style.cssText = "position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;visibility:hidden;pointer-events:none;";
      document.body.appendChild(div);
    }
    containerRef.current = div;

    loadYTScript();

    // Initialize player when API is ready
    const initPlayer = () => {
      if (playerRef.current) return;
      const player = new window.YT.Player(div, {
        width:  "1",
        height: "1",
        videoId: "",
        playerVars: {
          autoplay:       1,
          controls:       0,
          disablekb:      1,
          fs:             0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel:            0,
          origin:         window.location.origin,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            player.setVolume(Math.round(
              (usePlayerStore.getState().isMuted ? 0 : usePlayerStore.getState().volume) * 100
            ));
            // Load any track that was queued before player was ready
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
              // Buffering is normal loading state — keep playing intent active
              if (intendedPlayingRef.current) {
                usePlayerStore.getState().setIsPlaying(true);
              }
            } else if (e.data === YT.PAUSED) {
              // If we are currently transitioning to a new track, ignore transient unload PAUSE
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
      // Keep singleton in memory
    };
  }, []);

  // ── Load new video when streamUrl (videoId) changes ───────────────────────
  useEffect(() => {
    if (!streamUrl) return;
    const videoId = streamUrl;

    intendedPlayingRef.current = true;
    switchingTrackRef.current = true;

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

  // ── Sync play/pause from Zustand ──────────────────────────────────────────
  useEffect(() => {
    intendedPlayingRef.current = isPlaying;
    const p = playerRef.current;
    if (!p || !readyRef.current) return;

    // If switching tracks, do not prematurely pause
    if (switchingTrackRef.current && !isPlaying) return;

    try {
      if (isPlaying) p.playVideo();
      else p.pauseVideo();
    } catch (e) { /* ignore if not ready */ }
  }, [isPlaying]);

  // ── Volume ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    try {
      p.setVolume(Math.round((isMuted ? 0 : volume) * 100));
    } catch (e) { /* ignore */ }
  }, [volume, isMuted]);

  // ── Progress ticker (200ms smooth updates) ────────────────────────────────
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
    }, 200);

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

  // analyserRef is null — Visualizer should show simulated animation
  return { analyser: analyserRef, seek };
}
