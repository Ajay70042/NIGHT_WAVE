/**
 * CinematicView — Ultimate Full-Screen Cinema & Synced Karaoke Stage.
 * Features:
 * - Dynamic song-reactive background aurora
 * - Left panel: Floating album artwork + track title & artist + playback controls + seekbar
 * - Right panel: Floating synced lyrics with colorful floating words (or ambient visualizer)
 * - Always visible, never blank, with zero clunky boxes.
 */
import { useState, useEffect, useRef, memo } from "react";
import {
  X,
  Car,
  CloudRain,
  Building2,
  Sparkles,
  Heart,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Search,
  Music,
  Loader2,
} from "lucide-react";
import HeroBackground from "./HeroBackground";
import usePlayerStore from "../store/usePlayerStore";
import { formatTime } from "../lib/formatTime";

const SCENES = [
  { id: "song-aurora",    label: "Song Reactive 🌈", Icon: Sparkles   },
  { id: "night-drive",    label: "Night Drive 🚗",   Icon: Car        },
  { id: "rainy-window",   label: "Rainy Window 🌧️",  Icon: CloudRain  },
  { id: "tokyo-midnight", label: "Tokyo Midnight 🏙️",Icon: Building2  },
  { id: "cyber-dawn",     label: "Cyber Dawn ✨",    Icon: Sparkles   },
];

const WORD_COLORS = [
  "#38bdf8", // Sky Blue
  "#ec4899", // Neon Pink
  "#a3e635", // Lime Glow
  "#f59e0b", // Sunset Gold
  "#c084fc", // Lavender
  "#2dd4bf", // Teal
  "#f43f5e", // Rose
  "#818cf8", // Indigo
  "#fbbf24", // Yellow
  "#34d399", // Emerald
];

// ── Pure, Floating Synced Lyrics List ──────────────────────────────────────
const CinemaLyricsList = memo(function CinemaLyricsList({ lines, progress, onSeek }) {
  const activeLineRef = useRef(null);
  const prevIdxRef = useRef(-1);

  // Compute active index
  let activeIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= progress) {
      activeIdx = i;
    } else {
      break;
    }
  }

  // Smooth scroll only when active index changes
  useEffect(() => {
    if (activeIdx !== prevIdxRef.current) {
      prevIdxRef.current = activeIdx;
      if (activeLineRef.current) {
        activeLineRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeIdx]);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden">
      {/* Scroll container */}
      <div
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 space-y-6"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="h-[35vh]" />

        {lines.map((line, i) => {
          const isActive = i === activeIdx;
          const isPast = i < activeIdx;
          const words = line.text.split(" ");

          return (
            <div
              key={i}
              ref={isActive ? activeLineRef : null}
              onClick={() => onSeek(line.time)}
              className="cursor-pointer text-left py-2 px-1 select-none transition-all duration-300 ease-out group"
            >
              {isActive ? (
                /* Active: Pure floating colorful words */
                <div className="flex flex-wrap gap-x-3.5 gap-y-2 items-center text-3xl sm:text-4xl lg:text-5xl font-black font-display leading-tight tracking-tight">
                  {words.map((w, wIdx) => {
                    const color = WORD_COLORS[wIdx % WORD_COLORS.length];
                    return (
                      <span
                        key={wIdx}
                        className="animate-word-float inline-block transition-transform duration-200 hover:scale-105"
                        style={{
                          color: color,
                          animationDelay: `${wIdx * 100}ms`,
                          textShadow: `0 0 28px ${color}99, 0 2px 10px rgba(0,0,0,0.8)`,
                        }}
                      >
                        {w}
                      </span>
                    );
                  })}
                </div>
              ) : (
                /* Inactive: Floating translucent line */
                <p
                  className={`
                    text-xl sm:text-2xl lg:text-3xl font-bold transition-colors duration-300 leading-snug
                    ${isPast
                      ? "text-white/20 hover:text-white/60"
                      : "text-white/40 hover:text-white/80"
                    }
                  `}
                >
                  {line.text}
                </p>
              )}
            </div>
          );
        })}

        <div className="h-[40vh]" />
      </div>
    </div>
  );
});

// ── Main Cinema Stage Component ──────────────────────────────────────────
export default function CinematicView({ seek }) {
  const {
    toggleCinematic,
    activeScene,
    setScene,
    currentTrack,
    isPlaying,
    setIsPlaying,
    next,
    previous,
    lyrics,
    lyricsLoading,
    progress,
    duration,
    favorites,
    toggleFavorite,
    openSearch,
  } = usePlayerStore();

  const currentIdx  = SCENES.findIndex((s) => s.id === activeScene);
  const currentMeta = SCENES[currentIdx >= 0 ? currentIdx : 0];
  const nextScene   = SCENES[((currentIdx >= 0 ? currentIdx : 0) + 1) % SCENES.length];
  const { Icon: SceneIcon } = currentMeta;

  const isFav = currentTrack ? favorites?.some((t) => t.id === currentTrack.id) : false;
  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const hasSyncedLyrics = lyrics?.synced && lyrics.lines && lyrics.lines.length > 0;

  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-[#07070b] select-none text-white">
      {/* Dynamic song-reactive background */}
      <HeroBackground />

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="relative z-20 flex items-center justify-between px-6 pt-5 shrink-0">
        {/* Scene Pill */}
        <button
          onClick={() => setScene(nextScene.id)}
          title={`Switch scene to ${nextScene.label}`}
          className="
            group flex items-center gap-2
            rounded-full px-4 py-2 border border-white/15 bg-black/50 backdrop-blur-xl
            hover:bg-white/15 transition-all duration-150
            hover:scale-105 active:scale-95 shadow-xl
          "
        >
          <SceneIcon className="w-4 h-4 text-accent animate-pulse" />
          <span className="text-xs font-semibold text-white/90 group-hover:text-white transition-colors">
            {currentMeta.label}
          </span>
        </button>

        {/* Exit Button */}
        <button
          onClick={toggleCinematic}
          title="Exit cinema mode (Esc)"
          className="
            flex items-center gap-2
            rounded-full px-4 py-2 border border-white/15 bg-black/50 backdrop-blur-xl
            text-white/80 hover:text-white
            hover:bg-white/15 transition-all duration-150
            hover:scale-105 active:scale-95 shadow-xl
          "
        >
          <X className="w-4 h-4" />
          <span className="text-xs font-medium hidden sm:inline">Exit</span>
          <kbd className="text-[10px] text-white/40 bg-white/10 px-1.5 py-0.5 rounded border border-white/15 hidden md:inline">
            ESC
          </kbd>
        </button>
      </div>

      {/* ── Main Content Area ───────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {/* State 1: Idle (No Track Playing) */}
        {!currentTrack ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-5 animate-fade-in">
            <h1
              className="font-display font-extrabold leading-[0.88] tracking-tight text-white/90"
              style={{
                fontSize: "clamp(3.5rem, 10vw, 9rem)",
                textShadow: "0 2px 50px rgba(0,0,0,0.8)",
              }}
            >
              NightWave
            </h1>
            <p className="text-xs uppercase tracking-[0.45em] text-white/40 font-medium">
              Cinematic Ambient Player
            </p>
            <button
              onClick={openSearch}
              className="
                mt-3 flex items-center gap-2.5
                rounded-full border border-white/20 bg-black/50
                px-6 py-3 backdrop-blur-xl
                text-sm text-white font-medium
                hover:border-white/40 hover:bg-black/70
                transition-all duration-200 hover:scale-105 active:scale-95
                shadow-2xl
              "
            >
              <Search className="w-4 h-4 text-accent" />
              <span>Search for music</span>
              <kbd className="text-[10px] text-white/40 bg-white/10 px-2 py-0.5 rounded border border-white/15 ml-1">
                Ctrl K
              </kbd>
            </button>
          </div>
        ) : (
          /* State 2: Track is Playing — Full Cinema Stage */
          <div className="flex-1 flex flex-col lg:flex-row w-full h-full max-w-7xl mx-auto px-6 sm:px-12 py-4 gap-8 lg:gap-16 items-center justify-center">
            
            {/* ── Left Column: Album Art & Controls ── */}
            <div className="w-full lg:w-[42%] flex flex-col items-center lg:items-start justify-center gap-5 shrink-0">
              {/* Artwork Card */}
              <div className="w-48 h-48 sm:w-64 sm:h-64 lg:w-72 lg:h-72 rounded-3xl overflow-hidden border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.9)] bg-black/60 backdrop-blur-xl transition-transform duration-300 hover:scale-[1.02] shrink-0">
                {currentTrack.thumbnail ? (
                  <img
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                    <Music className="w-16 h-16 text-white/20" />
                  </div>
                )}
              </div>

              {/* Title & Artist */}
              <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-1.5 max-w-md">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold text-white tracking-tight line-clamp-2 leading-tight">
                  {currentTrack.title}
                </h1>
                
                <div className="flex items-center gap-2.5">
                  <p className="text-sm sm:text-base text-accent font-semibold tracking-wide uppercase">
                    {currentTrack.artist || "Unknown Artist"}
                  </p>
                  {isPlaying && (
                    <div className="flex items-end gap-0.5 h-3.5">
                      <span className="w-0.5 bg-accent rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-1.5" />
                      <span className="w-0.5 bg-accent rounded-full animate-[pulse_0.9s_ease-in-out_infinite] h-3.5" />
                      <span className="w-0.5 bg-accent rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-2" />
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => toggleFavorite(currentTrack)}
                  className={`p-3 rounded-full border border-white/15 bg-black/50 backdrop-blur-xl transition-all ${
                    isFav ? "text-red-500 border-red-500/40 scale-105" : "text-white/60 hover:text-white"
                  }`}
                  title="Favorite"
                >
                  <Heart className={`w-4 h-4 ${isFav ? "fill-current" : ""}`} />
                </button>

                <button
                  onClick={previous}
                  className="p-3 rounded-full border border-white/15 bg-black/50 backdrop-blur-xl text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                  title="Previous"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-4 rounded-full bg-accent text-obsidian shadow-[0_0_25px_rgba(163,230,53,0.45)] hover:scale-105 active:scale-95 transition-all font-bold"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <button
                  onClick={next}
                  className="p-3 rounded-full border border-white/15 bg-black/50 backdrop-blur-xl text-white/80 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                  title="Next"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>

              {/* Progress & Seekbar */}
              <div className="w-full max-w-xs flex items-center gap-2 pt-1">
                <span className="text-[11px] text-white/40 font-mono tabular-nums w-7 text-right shrink-0">
                  {formatTime(progress)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.5}
                  value={progress}
                  onChange={(e) => seek && seek(parseFloat(e.target.value))}
                  className="flex-1"
                  style={{
                    background: `linear-gradient(to right, rgba(163,230,53,0.9) ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%)`,
                  }}
                  aria-label="Seek track"
                />
                <span className="text-[11px] text-white/40 font-mono tabular-nums w-7 shrink-0">
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* ── Right Column: Lyrics or Visualizer ── */}
            <div className="w-full lg:w-[58%] h-full flex flex-col justify-center overflow-hidden">
              {hasSyncedLyrics ? (
                <CinemaLyricsList
                  lines={lyrics.lines}
                  progress={progress}
                  onSeek={seek}
                />
              ) : lyricsLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 text-white/40 py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  <p className="text-sm font-medium">Finding live synchronized lyrics…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center gap-4 py-20 animate-fade-in">
                  <Music className="w-12 h-12 text-white/20" />
                  <p className="text-xl font-bold text-white/70">Enjoying the vibes</p>
                  <p className="text-xs text-white/30 max-w-xs">
                    {currentTrack.artist} — {currentTrack.title}
                  </p>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
