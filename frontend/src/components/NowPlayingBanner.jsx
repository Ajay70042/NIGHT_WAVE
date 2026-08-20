/**
 * NowPlayingBanner — wide card shown at the top of browse home
 * when a track is currently active. Lets user jump into cinema mode.
 */
import { Maximize2, Pause, Play } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import { formatTime } from "../lib/formatTime";

export default function NowPlayingBanner() {
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    progress,
    duration,
    toggleCinematic,
  } = usePlayerStore();

  if (!currentTrack) return null;

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div
      className="
        mx-5 sm:mx-8 rounded-2xl overflow-hidden
        flex items-center gap-4
        px-4 py-3
        border border-white/[0.08]
      "
      style={{
        background: "rgba(20, 20, 30, 0.7)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Album art */}
      <div className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden ring-1 ring-white/10">
        {currentTrack.thumbnail ? (
          <img src={currentTrack.thumbnail} alt={currentTrack.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/[0.06]" />
        )}
      </div>

      {/* Track info + progress */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-between min-w-0 gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
            <p className="text-[11px] text-white/40 truncate">{currentTrack.artist}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-accent font-medium tracking-widest uppercase">
              Now Playing
            </span>
          </div>
        </div>

        {/* Mini progress bar */}
        <div className="w-full h-0.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-white/30 tabular-nums">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="
            w-9 h-9 rounded-full bg-white/10 hover:bg-white/20
            flex items-center justify-center
            text-white transition-all duration-150 active:scale-90
          "
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying
            ? <Pause className="w-4 h-4 fill-current" />
            : <Play className="w-4 h-4 fill-current ml-0.5" />
          }
        </button>

        <button
          onClick={toggleCinematic}
          title="Open cinema mode"
          className="
            w-9 h-9 rounded-full bg-accent/15 hover:bg-accent/25
            flex items-center justify-center
            text-accent transition-all duration-150 active:scale-90
          "
          aria-label="Cinema mode"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
