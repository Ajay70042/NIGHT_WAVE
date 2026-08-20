/**
 * HeroCenter — busdriver.wtf-style open layout.
 *
 * When idle   : large ambient "NightWave" title + search CTA in the center.
 * When playing : artist name (small, spaced caps) + track title (large display).
 *
 * The player controls all live in the bottom PlayerBar pill.
 * This component is intentionally minimal — lots of breathing room.
 */
import { Search } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";

export default function HeroCenter() {
  const { currentTrack, openSearch } = usePlayerStore();

  return (
    <div className="relative flex flex-col items-center justify-center flex-1 select-none px-6 text-center">

      {currentTrack ? (
        /* ── Playing state ──────────────────────────────────────── */
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          {/* Artist — small caps */}
          <p
            className="text-[11px] uppercase tracking-[0.4em] text-white/45 font-medium"
            style={{ textShadow: "0 1px 12px rgba(0,0,0,0.8)" }}
          >
            {currentTrack.artist}
          </p>

          {/* Title — large display font, up to 3 words */}
          <h1
            className="font-display font-extrabold leading-[0.88] tracking-tight text-white"
            style={{
              fontSize: "clamp(3rem, 9vw, 8rem)",
              textShadow: "0 2px 40px rgba(0,0,0,0.7)",
              maxWidth: "70vw",
              wordBreak: "break-word",
            }}
          >
            {currentTrack.title.split(" ").slice(0, 4).join(" ")}
          </h1>

          {/* Separator */}
          <div className="flex items-center gap-4 mt-1">
            <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/30" />
            <span className="text-[9px] uppercase tracking-[0.35em] text-white/30">
              Now Playing
            </span>
            <span className="h-px w-8 bg-gradient-to-l from-transparent to-white/30" />
          </div>
        </div>

      ) : (
        /* ── Idle state ─────────────────────────────────────────── */
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          {/* App name */}
          <h1
            className="font-display font-extrabold leading-[0.88] tracking-tight text-white/90"
            style={{
              fontSize: "clamp(4rem, 13vw, 11rem)",
              textShadow: "0 2px 50px rgba(0,0,0,0.6)",
            }}
          >
            NightWave
          </h1>

          <p
            className="text-[10px] uppercase tracking-[0.45em] text-white/35"
            style={{ textShadow: "0 1px 12px rgba(0,0,0,0.8)" }}
          >
            Your cinematic music player
          </p>

          {/* Play / search CTA */}
          <button
            onClick={openSearch}
            className="
              mt-2 flex items-center gap-2.5
              rounded-full border border-white/20 bg-black/30
              px-5 py-2.5
              backdrop-blur-xl
              text-sm text-white/70 hover:text-white
              hover:border-white/35 hover:bg-black/40
              transition-all duration-200 hover:scale-[1.03] active:scale-95
              shadow-[0_10px_30px_-8px_rgba(0,0,0,0.7)]
            "
          >
            <Search className="w-4 h-4" />
            <span>Search for music</span>
            <kbd className="text-[10px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 ml-1">
              Ctrl K
            </kbd>
          </button>
        </div>
      )}
    </div>
  );
}
