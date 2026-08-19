/**
 * HeroCenter — the main visual centerpiece of NightWave.
 * Shows the circular visualizer + disc art + track info.
 */
import { Search } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import Visualizer from "./Visualizer";

export default function HeroCenter({ analyserRef }) {
  const { currentTrack, isPlaying, openSearch } = usePlayerStore();

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 select-none">
      {/* Large ambient display title */}
      {currentTrack ? (
        <div className="text-center mb-6 animate-fade-in">
          <h1
            className="font-display text-6xl md:text-8xl font-bold text-white/90 leading-none tracking-tight"
            style={{ textShadow: "0 4px 40px rgba(0,0,0,0.8)" }}
          >
            {currentTrack.title.split(" ").slice(0, 3).join(" ")}
          </h1>
          <p className="text-sm uppercase tracking-[0.25em] text-white/40 mt-3">
            {currentTrack.artist}
          </p>
        </div>
      ) : (
        <div className="text-center mb-8">
          <h1 className="font-display text-7xl md:text-9xl font-bold text-white/10 leading-none">
            NightWave
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-white/20 mt-4">
            Your cinematic music player
          </p>
        </div>
      )}

      {/* Visualizer ring + disc art */}
      <div className="relative flex items-center justify-center" style={{ width: 280, height: 280 }}>
        {/* Canvas visualizer */}
        <div className="absolute inset-0">
          <Visualizer analyserRef={analyserRef} />
        </div>

        {/* Disc / album art */}
        <div
          className={`
            relative w-36 h-36 rounded-full overflow-hidden
            ring-1 ring-white/10 shadow-2xl
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
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
              <Search className="w-10 h-10 text-white/20" />
            </div>
          )}
          {/* Center hole */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-[#0a0a0c] ring-1 ring-white/10" />
          </div>
        </div>
      </div>

      {/* CTA when nothing playing */}
      {!currentTrack && (
        <div className="mt-10 flex flex-col items-center gap-3 animate-fade-in">
          <button
            onClick={openSearch}
            className="
              flex items-center gap-2 px-6 py-3 rounded-full
              bg-white/5 hover:bg-white/10 border border-white/10
              text-sm text-white/60 hover:text-white
              transition-all duration-200 hover:scale-105 active:scale-95
            "
          >
            <Search className="w-4 h-4" />
            <span>Search for music</span>
            <kbd className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 ml-1">
              Ctrl K
            </kbd>
          </button>
          <p className="text-xs text-white/20">or press <kbd className="font-mono">/</kbd> to search</p>
        </div>
      )}
    </div>
  );
}
