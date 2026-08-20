/**
 * PlayerBar — busdriver.wtf-style compact bottom pill.
 *
 * Layout (single rounded pill, ~max-w-2xl, pinned to bottom):
 *
 *  ┌─ thumbnail disc ─ track info + seekbar ─ prev/play/next ─ vol/queue/lyrics ─┐
 *  └──────────────────────────────────────────────────────────────────────────────┘
 *
 * All controls are contained inside one glassmorphism pill.
 */
import { useCallback, useState, useRef } from "react";
import {
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Volume2, VolumeX, ListMusic, Mic2, Loader2, Maximize2, Heart, Radio,
} from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import MarqueeText from "./MarqueeText";
import { formatTime } from "../lib/formatTime";

function IconBtn({ onClick, children, active = false, title, disabled = false, className = "" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`
        relative flex items-center justify-center w-9 h-9 rounded-full
        transition-all duration-200 ease-out
        hover:bg-white/10 active:scale-90
        disabled:opacity-30 disabled:pointer-events-none
        ${active ? "text-accent" : "text-white/60 hover:text-white"}
        ${className}
      `}
    >
      {children}
      {active && (
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
      )}
    </button>
  );
}

export default function PlayerBar({ seek }) {
  const {
    currentTrack, isPlaying, isLoading, progress, duration,
    volume, isMuted, isShuffle, repeatMode, isAutoplay,
    isQueueOpen, isLyricsOpen, favorites,
    setIsPlaying, setVolume, toggleMute, toggleShuffle, cycleRepeat, toggleAutoplay,
    toggleQueue, toggleLyrics, toggleCinematic, toggleFavorite,
    next, previous,
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
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setTooltip({ visible: true, x: e.clientX - rect.left, time: pct * duration });
    },
    [duration]
  );

  const handleSeekMouseLeave = useCallback(() => {
    setTooltip((p) => ({ ...p, visible: false }));
  }, []);

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  return (
    /* Outer container — centres the pill horizontally */
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-5"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 20px)" }}
    >
      {/* The pill itself */}
      <div
        className="
          w-full max-w-2xl
          rounded-[2rem] sm:rounded-full
          border border-white/[0.10]
          shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]
          flex flex-col sm:flex-row sm:items-center
          gap-0 sm:gap-4
          px-3 py-3 sm:py-2 sm:pr-4 sm:pl-3
          overflow-hidden
        "
        style={{
          background: "rgba(10,10,15,0.72)",
          backdropFilter: "blur(40px) saturate(160%)",
          WebkitBackdropFilter: "blur(40px) saturate(160%)",
        }}
      >

        {/* ── Left: thumbnail + track info ────────────────────────── */}
        <div className="flex items-center gap-3 sm:w-[220px] min-w-0 shrink-0">
          {/* Thumbnail — vinyl disc style circle */}
          <div className="relative shrink-0">
            <div
              className={`
                w-12 h-12 rounded-full overflow-hidden ring-1 ring-white/15
                ${isPlaying ? "animate-spin-slow" : ""}
              `}
            >
              {currentTrack?.thumbnail ? (
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/5 flex items-center justify-center">
                  <ListMusic className="w-5 h-5 text-white/20" />
                </div>
              )}
            </div>
            {/* Center hole */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3 h-3 rounded-full bg-[#0a0a0c] ring-1 ring-white/20" />
            </div>
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              </div>
            )}
          </div>

          {/* Track name + artist */}
          <div className="min-w-0 flex-1">
            <MarqueeText
              text={currentTrack?.title || "Nothing playing"}
              className="text-sm font-semibold text-white leading-tight"
            />
            <p className="text-[11px] text-white/40 truncate mt-0.5">
              {currentTrack?.artist || "—"}
            </p>
          </div>

          {/* Favorite button */}
          <button
            onClick={() => currentTrack && toggleFavorite(currentTrack)}
            disabled={!currentTrack}
            className={`shrink-0 p-1.5 rounded-full transition-colors ${
              isFavorite ? "text-accent" : "text-white/30 hover:text-white"
            } disabled:opacity-30 disabled:pointer-events-none`}
            title="Favorite"
          >
            <Heart className="w-4 h-4" fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>

        {/* ── Center: seekbar + main controls ─────────────────────── */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0 px-1 sm:px-0 mt-2 sm:mt-0">
          {/* Seekbar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/30 tabular-nums w-7 text-right shrink-0">
              {formatTime(progress)}
            </span>

            <div
              ref={seekbarRef}
              className="relative flex-1 group"
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
                className="w-full"
                style={{
                  background: `linear-gradient(to right, rgba(163,230,53,0.7) ${progressPercent}%, rgba(255,255,255,0.12) ${progressPercent}%)`,
                }}
                aria-label="Seek"
              />
            </div>

            <span className="text-[10px] text-white/30 tabular-nums w-7 shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Playback controls row */}
          <div className="flex items-center justify-center gap-0.5">
            <IconBtn onClick={toggleShuffle} active={isShuffle} title="Shuffle (S)">
              <Shuffle className="w-3.5 h-3.5" />
            </IconBtn>

            <IconBtn onClick={previous} title="Previous (P)">
              <SkipBack className="w-4 h-4 fill-current" />
            </IconBtn>

            {/* Play/Pause — large */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!currentTrack || isLoading}
              aria-label={isPlaying ? "Pause" : "Play"}
              title="Play/Pause (Space)"
              className="
                flex items-center justify-center w-12 h-12 rounded-full
                bg-white text-obsidian
                hover:bg-accent hover:scale-105
                active:scale-95 transition-all duration-150
                disabled:opacity-40 disabled:pointer-events-none
                shadow-lg mx-1
              "
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <IconBtn onClick={next} title="Next (N)" disabled={!currentTrack}>
              <SkipForward className="w-4 h-4 fill-current" />
            </IconBtn>

            <IconBtn
              onClick={cycleRepeat}
              active={repeatMode !== "none"}
              title={`Repeat: ${repeatMode}`}
            >
              <RepeatIcon className="w-3.5 h-3.5" />
            </IconBtn>
          </div>
        </div>

        {/* ── Right: volume + panel toggles ───────────────────────── */}
        <div className="hidden sm:flex items-center gap-1 shrink-0">
          {/* Autoplay / Smart Radio */}
          <IconBtn
            onClick={toggleAutoplay}
            active={isAutoplay}
            title={`Infinite Autoplay: ${isAutoplay ? "ON" : "OFF"}`}
          >
            <Radio className="w-3.5 h-3.5" />
          </IconBtn>

          {/* Lyrics */}
          <IconBtn
            onClick={toggleLyrics}
            active={isLyricsOpen}
            title="Lyrics (L)"
            disabled={!currentTrack}
          >
            <Mic2 className="w-3.5 h-3.5" />
          </IconBtn>

          {/* Queue */}
          <IconBtn onClick={toggleQueue} active={isQueueOpen} title="Queue (Q)">
            <ListMusic className="w-3.5 h-3.5" />
          </IconBtn>

          {/* Cinema mode */}
          <IconBtn onClick={toggleCinematic} title="Cinema mode">
            <Maximize2 className="w-3.5 h-3.5" />
          </IconBtn>

          {/* Mute */}
          <IconBtn onClick={toggleMute} title="Mute (M)">
            {isMuted || volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </IconBtn>

          {/* Volume slider */}
          <div className="w-20">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.65) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%)`,
              }}
              aria-label="Volume"
            />
          </div>
        </div>

        {/* ── Mobile-only bottom row: panel toggles ───────────────── */}
        <div className="flex sm:hidden items-center justify-between px-2 pb-1 mt-1">
          <IconBtn onClick={toggleShuffle} active={isShuffle} title="Shuffle">
            <Shuffle className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn onClick={toggleAutoplay} active={isAutoplay} title="Autoplay">
            <Radio className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn onClick={toggleMute} title="Mute">
            {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </IconBtn>
          <IconBtn onClick={toggleLyrics} active={isLyricsOpen} title="Lyrics" disabled={!currentTrack}>
            <Mic2 className="w-3.5 h-3.5" />
          </IconBtn>
          <IconBtn onClick={toggleQueue} active={isQueueOpen} title="Queue">
            <ListMusic className="w-3.5 h-3.5" />
          </IconBtn>
        </div>
      </div>
    </div>
  );
}
