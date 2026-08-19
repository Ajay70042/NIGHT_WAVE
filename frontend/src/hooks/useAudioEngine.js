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
  const playerRef    = useRef(null);   // YT.Player instance
  const containerRef = useRef(null);   // hidden div for iframe
  const analyserRef  = useRef(null);   // dummy — keeps Visualizer happy
  const animFrameRef = useRef(null);
  const readyRef     = useRef(false);
  const pendingIdRef = useRef(null);   // videoId to load when player is ready

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
    const div = document.createElement("div");
    div.id = "yt-player-container";
    div.style.cssText = "position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;visibility:hidden;";
    document.body.appendChild(div);
    containerRef.current = div;

    loadYTScript();

    // Initialize player when API is ready
    const initPlayer = () => {
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
              player.loadVideoById(pendingIdRef.current);
              pendingIdRef.current = null;
            }
          },
          onStateChange: (e) => {
            const YT = window.YT.PlayerState;
            if (e.data === YT.PLAYING) {
              usePlayerStore.getState().setIsPlaying(true);
              const dur = player.getDuration?.() || 0;
              if (dur > 0) usePlayerStore.getState().setDuration(dur);
            } else if (e.data === YT.PAUSED) {
              usePlayerStore.getState().setIsPlaying(false);
            } else if (e.data === YT.ENDED) {
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
            usePlayerStore.getState().setIsPlaying(false);
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
      playerRef.current?.destroy?.();
      div.remove();
    };
  }, []);

  // ── Load new video when streamUrl (videoId) changes ───────────────────────
  useEffect(() => {
    if (!streamUrl) return;
    // streamUrl now holds the video ID directly
    const videoId = streamUrl;

    if (!readyRef.current || !playerRef.current) {
      pendingIdRef.current = videoId;
      return;
    }

    try {
      playerRef.current.loadVideoById(videoId);
    } catch (e) {
      console.error("YT loadVideoById error:", e);
    }
  }, [streamUrl]);

  // ── Sync play/pause from Zustand ──────────────────────────────────────────
  useEffect(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
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

  // ── Progress ticker ───────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const p = playerRef.current;
      if (p && readyRef.current) {
        try {
          const t = p.getCurrentTime?.() || 0;
          if (t > 0) setProgress(t);
          const dur = p.getDuration?.() || 0;
          if (dur > 0 && usePlayerStore.getState().duration !== dur) {
            usePlayerStore.getState().setDuration(dur);
          }
        } catch (e) { /* ignore */ }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
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
