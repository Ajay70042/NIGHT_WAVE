/**
 * BrowseCard — Spotify-style vertical track card.
 * Shows a square thumbnail with hover play overlay,
 * track title (2-line clamp), and artist name.
 */
import { Play } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";

export default function BrowseCard({ track }) {
  const { playTrack, currentTrack, isPlaying } = usePlayerStore();
  const isActive = currentTrack?.id === track.id;

  return (
    <button
      onClick={() => playTrack(track)}
      className="
        group flex flex-col gap-2.5
        w-36 sm:w-40 shrink-0
        text-left transition-transform duration-200
        hover:scale-[1.02] active:scale-[0.98]
      "
      title={`${track.title} — ${track.artist}`}
    >
      {/* Square thumbnail */}
      <div className="relative w-full aspect-square rounded-xl overflow-hidden ring-1 ring-white/10">
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-white/[0.06] flex items-center justify-center">
            <span className="text-white/20 text-3xl">♪</span>
          </div>
        )}

        {/* Hover overlay with play button */}
        <div
          className="
            absolute inset-0 bg-black/50 flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity duration-200
          "
        >
          <div
            className={`
              w-10 h-10 rounded-full flex items-center justify-center
              shadow-lg transition-transform duration-150
              ${isActive && isPlaying
                ? "bg-accent scale-100"
                : "bg-white scale-90 group-hover:scale-100"
              }
            `}
          >
            <Play
              className={`w-4 h-4 fill-current ml-0.5 ${isActive && isPlaying ? "text-obsidian" : "text-obsidian"}`}
            />
          </div>
        </div>

        {/* Active indicator dot */}
        {isActive && (
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
        )}
      </div>

      {/* Track info */}
      <div className="px-0.5 min-w-0">
        <p
          className={`
            text-[13px] font-medium leading-tight line-clamp-2
            ${isActive ? "text-accent" : "text-white/90"}
          `}
        >
          {track.title}
        </p>
        <p className="text-[11px] text-white/40 truncate mt-0.5">
          {track.artist}
        </p>
      </div>
    </button>
  );
}
