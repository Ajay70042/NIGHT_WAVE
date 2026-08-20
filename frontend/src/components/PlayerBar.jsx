/**
 * PlayerBar — Ultra-sleek, modern floating glass player dock.
 * Inspired by Apple Music and macOS floating controls:
 * - Left: Rounded artwork + crisp track title & artist + favorite heart
 * - Center: Tactile playback controls with glowing hero play button + smooth micro seekbar
 * - Right: Karaoke lyrics toggle, Smart autoplay, Queue, Cinema mode, and smooth Volume slider
 */
import { useCallback, useState, useRef } from "react";
import {
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Mic2,
  Loader2,
  Maximize2,
  Heart,
  Radio,
} from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import MarqueeText from "./MarqueeText";
import { formatTime } from "../lib/formatTime";

function IconButton({
  onClick,
  children,
  active = false,
  title,
  disabled = false,
  className = "",
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`
        relative flex items-center justify-center w-8 h-8 rounded-full
        transition-all duration-150 ease-out
        hover:bg-white/10 active:scale-90
        disabled:opacity-30 disabled:pointer-events-none
        ${active ? "text-accent" : "text-white/60 hover:text-white"}
        ${className}
      `}
    >
      {children}
      {active && (
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent shadow-[0_0_6px_#a3e635]" />
      )}
    </button>
  );
}

export default function PlayerBar({ seek }) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    progress,
    duration,
    volume,
    isMuted,
    isShuffle,
    repeatMode,
    isAutoplay,
    isQueueOpen,
    isLyricsOpen,
    favorites,
    setIsPlaying,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    toggleAutoplay,
    toggleQueue,
    toggleLyrics,
    toggleCinematic,
    toggleFavorite,
    next,
    previous,
  } = usePlayerStore();

  const isFavorite = currentTrack && favorites.some((t) => t.id === currentTrack.id);

  const handleSeek = useCallback(
    (e) => seek(parseFloat(e.target.value)),
    [seek]
  );

  const handleVolumeChange = useCallback(
    (e) => setVolume(parseFloat(e.target.value)),
    [setVolume]
  );

  // Seekbar hover tooltip
  const seekbarRef = useRef(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, time: 0 });

  const handleSeekMouseMove = useCallback(
    (e) => {
      const bar = seekbarRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setTooltip({ visible: true, x: e.clientX - rect.left, time: pct * duration });
    },
    [duration]
  );

  const handleSeekMouseLeave = useCallback(() => {
    setTooltip((p) => ({ ...p, visible: false }));
  }, []);

  const handlePrevious = useCallback(() => {
    const res = previous();
    if (res === "restart" && seek) {
      seek(0);
    }
  }, [previous, seek]);

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-4 select-none pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
    >
      {/* ── Main Glass Dock ── */}
      <div
        className="
          pointer-events-auto
          w-full max-w-4xl
          rounded-2xl sm:rounded-full
          border border-white/15
          shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_1px_rgba(255,255,255,0.2)]
          flex flex-col sm:flex-row sm:items-center
          justify-between
          gap-2 sm:gap-4
          px-3.5 py-2.5 sm:py-2 sm:px-5
          overflow-hidden
        "
        style={{
          background: "rgba(13, 13, 18, 0.85)",
          backdropFilter: "blur(30px) saturate(190%)",
          WebkitBackdropFilter: "blur(30px) saturate(190%)",
        }}
      >
        {/* ── Left Column: Track Artwork & Meta ── */}
        <div className="flex items-center gap-3 sm:w-[240px] min-w-0 shrink-0">
          {/* Rounded Thumbnail */}
          <div className="relative w-11 h-11 rounded-xl overflow-hidden border border-white/10 shadow-md shrink-0 bg-white/5">
            {currentTrack?.thumbnail ? (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20">
                ♪
              </div>
            )}
            {/* Loading Spinner */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              </div>
            )}
          </div>

          {/* Title & Artist */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <MarqueeText
                text={currentTrack?.title || "NightWave"}
                className="text-[13px] font-bold text-white leading-tight"
              />
              {isPlaying && (
                <div className="flex items-end gap-0.5 h-2.5 shrink-0">
                  <span className="w-0.5 bg-accent rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-1.5" />
                  <span className="w-0.5 bg-accent rounded-full animate-[pulse_0.9s_ease-in-out_infinite] h-2.5" />
                  <span className="w-0.5 bg-accent rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-2" />
                </div>
              )}
            </div>
            <p className="text-[11px] text-white/40 truncate mt-0.5 font-medium">
              {currentTrack?.artist || "Select a song to play"}
            </p>
          </div>

          {/* Favorite Button */}
          <button
            onClick={() => currentTrack && toggleFavorite(currentTrack)}
            disabled={!currentTrack}
            className={`shrink-0 p-1.5 rounded-full transition-all ${
              isFavorite ? "text-red-500 scale-110" : "text-white/30 hover:text-white"
            } disabled:opacity-20 disabled:pointer-events-none`}
            title="Favorite"
          >
            <Heart className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        {/* ── Center Column: Playback Controls & Minimal Seekbar ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-1 min-w-0 max-w-md mx-auto w-full">
          {/* Controls row */}
          <div className="flex items-center gap-2">
            <IconButton onClick={toggleShuffle} active={isShuffle} title="Shuffle (S)">
              <Shuffle className="w-3.5 h-3.5" />
            </IconButton>

            <IconButton onClick={handlePrevious} title="Previous (P)" disabled={!currentTrack}>
              <SkipBack className="w-4 h-4 fill-current" />
            </IconButton>

            {/* Glowing Hero Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!currentTrack || isLoading}
              aria-label={isPlaying ? "Pause" : "Play"}
              title="Play / Pause (Space)"
              className="
                flex items-center justify-center w-9 h-9 rounded-full
                bg-white text-obsidian hover:bg-accent hover:scale-105
                active:scale-95 transition-all duration-150
                shadow-[0_0_15px_rgba(255,255,255,0.2)]
                disabled:opacity-30 disabled:pointer-events-none
                mx-1 font-bold
              "
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-obsidian" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <IconButton onClick={next} title="Next (N)" disabled={!currentTrack}>
              <SkipForward className="w-4 h-4 fill-current" />
            </IconButton>

            <IconButton
              onClick={cycleRepeat}
              active={repeatMode !== "none"}
              title={`Repeat: ${repeatMode}`}
            >
              <RepeatIcon className="w-3.5 h-3.5" />
            </IconButton>
          </div>

          {/* Micro Seekbar */}
          <div className="w-full flex items-center gap-2 px-1">
            <span className="text-[10px] text-white/30 font-mono tabular-nums w-6 text-right shrink-0">
              {formatTime(progress)}
            </span>

            <div
              ref={seekbarRef}
              className="relative flex-1 group py-1"
              onMouseMove={handleSeekMouseMove}
              onMouseLeave={handleSeekMouseLeave}
            >
              {/* Tooltip */}
              {tooltip.visible && duration > 0 && (
                <div className="seekbar-tooltip" style={{ left: tooltip.x }}>
                  {formatTime(tooltip.time)}
                </div>
              )}
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.5}
                value={progress}
                onChange={handleSeek}
                disabled={!currentTrack}
                className="w-full block"
                style={{
                  background: `linear-gradient(to right, rgba(163,230,53,0.9) ${progressPercent}%, rgba(255,255,255,0.12) ${progressPercent}%)`,
                }}
                aria-label="Seek track"
              />
            </div>

            <span className="text-[10px] text-white/30 font-mono tabular-nums w-6 shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* ── Right Column: Utilities & Volume ── */}
        <div className="hidden sm:flex items-center justify-end gap-1 sm:w-[240px] shrink-0">
          {/* Autoplay Toggle */}
          <IconButton
            onClick={toggleAutoplay}
            active={isAutoplay}
            title={`Infinite Autoplay: ${isAutoplay ? "ON" : "OFF"}`}
          >
            <Radio className="w-3.5 h-3.5" />
          </IconButton>

          {/* Lyrics Drawer Toggle */}
          <IconButton
            onClick={toggleLyrics}
            active={isLyricsOpen}
            title="Lyrics (L)"
            disabled={!currentTrack}
          >
            <Mic2 className="w-3.5 h-3.5" />
          </IconButton>

          {/* Queue Drawer Toggle */}
          <IconButton onClick={toggleQueue} active={isQueueOpen} title="Queue (Q)">
            <ListMusic className="w-3.5 h-3.5" />
          </IconButton>

          {/* Cinema Mode Toggle */}
          <IconButton onClick={toggleCinematic} title="Cinema Mode (C)">
            <Maximize2 className="w-3.5 h-3.5" />
          </IconButton>

          {/* Mute Button */}
          <IconButton onClick={toggleMute} title="Mute (M)">
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-white/40" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </IconButton>

          {/* Volume Slider */}
          <div className="w-16 ml-1">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.7) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.12) ${(isMuted ? 0 : volume) * 100}%)`,
              }}
              aria-label="Volume slider"
            />
          </div>
        </div>

        {/* ── Mobile Action Row ── */}
        <div className="flex sm:hidden items-center justify-between px-2 pt-1 border-t border-white/5">
          <IconButton onClick={toggleShuffle} active={isShuffle} title="Shuffle">
            <Shuffle className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton onClick={toggleAutoplay} active={isAutoplay} title="Autoplay">
            <Radio className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton onClick={toggleLyrics} active={isLyricsOpen} title="Lyrics" disabled={!currentTrack}>
            <Mic2 className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton onClick={toggleQueue} active={isQueueOpen} title="Queue">
            <ListMusic className="w-3.5 h-3.5" />
          </IconButton>
          <IconButton onClick={toggleCinematic} title="Cinema">
            <Maximize2 className="w-3.5 h-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
