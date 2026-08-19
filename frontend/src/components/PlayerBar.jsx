/**
 * PlayerBar — fixed bottom strip with full playback controls.
 * Layout: [Album Art + Track Info] | [Controls + Seekbar] | [Volume + Actions]
 */
import { useCallback } from "react";
import {
  Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1,
  Volume2, VolumeX, ListMusic, Mic2, Heart, Loader2,
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
    volume, isMuted, isShuffle, repeatMode,
    isQueueOpen, isLyricsOpen,
    setIsPlaying, setVolume, toggleMute, toggleShuffle, cycleRepeat,
    toggleQueue, toggleLyrics,
    next, previous,
    openSearch,
  } = usePlayerStore();

  const handleSeek = useCallback(
    (e) => seek(parseFloat(e.target.value)),
    [seek]
  );

  const handleVolumeChange = useCallback(
    (e) => setVolume(parseFloat(e.target.value)),
    [setVolume]
  );

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 glass-strong border-t border-white/[0.06]"
      style={{ height: "80px" }}
    >
      <div className="flex items-center h-full px-4 gap-4 max-w-screen-2xl mx-auto">

        {/* ── Left: Album art + track info ─────────────────── */}
        <div className="flex items-center gap-3 w-[280px] min-w-0 shrink-0">
          <div className="relative w-12 h-12 shrink-0">
            {currentTrack?.thumbnail ? (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-12 h-12 rounded-lg object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
                <ListMusic className="w-5 h-5 text-white/20" />
              </div>
            )}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <MarqueeText
              text={currentTrack?.title || "Nothing playing"}
              className="text-sm font-medium text-white leading-tight"
            />
            <p className="text-xs text-white/40 truncate mt-0.5">
              {currentTrack?.artist || "—"}
            </p>
          </div>

          <IconBtn
            title="Like"
            className="shrink-0 text-white/30 hover:text-red-400"
          >
            <Heart className="w-4 h-4" />
          </IconBtn>
        </div>

        {/* ── Center: Controls + Seekbar ───────────────────── */}
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          {/* Controls row */}
          <div className="flex items-center gap-1">
            <IconBtn
              onClick={toggleShuffle}
              active={isShuffle}
              title="Shuffle (S)"
            >
              <Shuffle className="w-4 h-4" />
            </IconBtn>

            <IconBtn onClick={previous} title="Previous (P)">
              <SkipBack className="w-4 h-4 fill-current" />
            </IconBtn>

            {/* Play/Pause — larger */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!currentTrack || isLoading}
              aria-label={isPlaying ? "Pause" : "Play"}
              title="Play/Pause (Space)"
              className={`
                flex items-center justify-center w-11 h-11 rounded-full
                bg-white text-obsidian font-bold
                hover:bg-accent hover:scale-105
                active:scale-95 transition-all duration-150
                disabled:opacity-40 disabled:pointer-events-none
                shadow-lg
              `}
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
              <RepeatIcon className="w-4 h-4" />
            </IconBtn>
          </div>

          {/* Seekbar row */}
          <div className="flex items-center gap-2 w-full max-w-lg">
            <span className="text-[10px] text-white/30 tabular-nums w-8 text-right shrink-0">
              {formatTime(progress)}
            </span>

            <div className="relative flex-1 group">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-accent/60 pointer-events-none h-[3px] my-auto"
                style={{ width: `${progressPercent}%`, top: 0, bottom: 0 }}
              />
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
                  background: `linear-gradient(to right, rgba(163,230,53,0.6) ${progressPercent}%, rgba(255,255,255,0.1) ${progressPercent}%)`,
                }}
                aria-label="Seek"
              />
            </div>

            <span className="text-[10px] text-white/30 tabular-nums w-8 shrink-0">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* ── Right: Volume + panel toggles ────────────────── */}
        <div className="flex items-center gap-2 w-[220px] justify-end shrink-0">
          {/* Lyrics toggle */}
          <IconBtn
            onClick={toggleLyrics}
            active={isLyricsOpen}
            title="Lyrics (L)"
            disabled={!currentTrack}
          >
            <Mic2 className="w-4 h-4" />
          </IconBtn>

          {/* Queue toggle */}
          <IconBtn
            onClick={toggleQueue}
            active={isQueueOpen}
            title="Queue (Q)"
          >
            <ListMusic className="w-4 h-4" />
          </IconBtn>

          {/* Volume */}
          <IconBtn onClick={toggleMute} title="Mute (M)">
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </IconBtn>

          <div className="w-24 group">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-full"
              style={{
                background: `linear-gradient(to right, rgba(255,255,255,0.7) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%)`,
              }}
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
