import { Play, Clock } from "lucide-react";
import { formatTime } from "../lib/formatTime";
import usePlayerStore from "../store/usePlayerStore";
import { prefetchStream } from "../lib/api";

export default function TrackCard({ track, compact = false, onSelect }) {
  const { playTrack, addToQueue, currentTrack } = usePlayerStore();
  const isActive = currentTrack?.id === track.id;

  const handleWarmCache = () => {
    if (track?.id) prefetchStream(track.id);
  };

  const handleClick = () => {
    if (onSelect) {
      onSelect(track);
    } else {
      playTrack(track);
    }
  };

  return (
    <div
      className={`
        group flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer
        transition-all duration-150 ease-out
        hover:bg-white/[0.07] active:bg-white/10
        ${isActive ? "bg-accent/10 ring-1 ring-accent/20" : ""}
      `}
      onClick={handleClick}
      onMouseEnter={handleWarmCache}
      onTouchStart={handleWarmCache}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      aria-label={`Play ${track.title} by ${track.artist}`}
    >
      {/* Thumbnail */}
      <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-white/5" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-4 h-4 text-white fill-white" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate leading-tight ${isActive ? "text-accent" : "text-white"}`}>
          {track.title}
        </p>
        <p className="text-xs text-white/40 truncate mt-0.5">
          {track.artist}
          {track.album && <span className="text-white/20"> · {track.album}</span>}
        </p>
      </div>

      {/* Duration */}
      {!compact && (
        <span className="text-xs text-white/30 tabular-nums shrink-0">
          {track.durationStr || formatTime(track.duration)}
        </span>
      )}

      {/* Add to queue (hidden, show on hover) */}
      <button
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white/40 hover:text-white px-2 py-1 rounded-md hover:bg-white/10"
        onClick={(e) => { e.stopPropagation(); addToQueue(track); }}
        aria-label="Add to queue"
        title="Add to queue"
      >
        +Q
      </button>
    </div>
  );
}
