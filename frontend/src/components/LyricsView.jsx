/**
 * LyricsView — Apple Music-style word-by-word karaoke.
 *
 * Apple Music design principles implemented here:
 * - Purely WHITE text — no color changes, only opacity + scale
 * - Active line is BIG (~26px bold), inactive lines are SMALL (~14px)
 * - The size contrast is the core visual signal for the active line
 * - Within active line: sung words dim to 45%, current word = 100% + white glow,
 *   upcoming words = 22% (very faint, just readable)
 * - Fast transitions: 160ms ease-out (feels snappy, not laggy)
 * - Words rendered as natural flowing prose, not as a list
 */
import { useEffect, useRef } from "react";
import { X, Mic2, Loader2, Music, Sparkles } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import { getActiveLineIdx, getWordActivations } from "../lib/wordSync";


export default function LyricsView({ seek }) {
  const { isLyricsOpen, toggleLyrics, lyrics, lyricsLoading, progress, currentTrack } =
    usePlayerStore();

  const containerRef = useRef(null);
  const activeLineRef = useRef(null);
  const prevIdxRef = useRef(-1);
  const prevTrackId = useRef(null);

  // Reset scroll position and active index whenever the track changes
  useEffect(() => {
    if (currentTrack?.id !== prevTrackId.current) {
      prevTrackId.current = currentTrack?.id || null;
      prevIdxRef.current = -1;
      // Scroll lyrics pane back to top on track change
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  }, [currentTrack]);

  // Guard: don't highlight any line until progress has moved past the first lyric's timestamp.
  // This prevents lyrics from appearing "stuck" at line 0 before music actually starts.
  const firstLineTime = lyrics?.synced && lyrics.lines?.length > 0 ? lyrics.lines[0].time : 0;
  const activeIdx =
    lyrics?.synced && lyrics.lines && progress >= firstLineTime
      ? getActiveLineIdx(lyrics.lines, progress)
      : -1;

  const wordActivations =
    activeIdx >= 0 && lyrics?.synced && lyrics.lines
      ? getWordActivations(lyrics.lines, activeIdx, progress)
      : [];

  useEffect(() => {
    if (activeIdx !== prevIdxRef.current && activeIdx >= 0) {
      prevIdxRef.current = activeIdx;
      activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeIdx]);

  const handleLineClick = (time) => {
    if (seek && typeof time === "number") seek(time);
  };

  return (
    <>
      {isLyricsOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={toggleLyrics} />
      )}

      <div
        className={`
          fixed top-0 right-0 bottom-[100px] z-40 w-full sm:w-96
          bg-black/35 backdrop-blur-2xl border-l border-white/10
          flex flex-col shadow-2xl
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isLyricsOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-white">Live Lyrics</h2>
            {lyrics?.synced && (
              <span className="flex items-center gap-1 text-[10px] font-medium bg-accent/15 text-accent border border-accent/20 px-2 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5" />
                SYNCED
              </span>
            )}
          </div>
          <button
            onClick={toggleLyrics}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            title="Close lyrics"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Track context */}
        {currentTrack && (
          <div className="px-5 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
            <p className="text-xs font-semibold text-white/90 truncate">{currentTrack.title}</p>
            <p className="text-[11px] text-white/40 truncate">{currentTrack.artist || "Unknown Artist"}</p>
          </div>
        )}

        {/* Content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-5 py-6 select-none"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
        >
          {lyricsLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-sm">Finding synchronized lyrics…</p>
            </div>
          )}

          {!lyricsLoading && lyrics && !lyrics.synced && !lyrics.plain && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/25 text-center">
              <Music className="w-10 h-10 opacity-30 mx-auto" />
              <p className="text-sm font-medium">No lyrics available</p>
              <p className="text-xs text-white/20">Instrumental or unlisted track</p>
            </div>
          )}

          {!lyricsLoading && !lyrics && !currentTrack && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/25 text-center">
              <Mic2 className="w-10 h-10 opacity-30 mx-auto" />
              <p className="text-sm">Play a track to view live lyrics</p>
            </div>
          )}

          {!lyricsLoading && lyrics?.plain && !lyrics?.synced && (
            <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-sans text-center py-8">
              {lyrics.plain}
            </pre>
          )}

          {/* ── Apple Music-style synced lyrics ── */}
          {!lyricsLoading && lyrics?.synced && lyrics.lines && (
            <div className="flex flex-col pb-36">
              <div style={{ height: "38vh" }} />

              {lyrics.lines.map((line, i) => {
                const isActive = i === activeIdx;
                const isPast = i < activeIdx;
                const words = line.words && line.words.length > 0
                  ? line.words.map((w) => w.text)
                  : line.text.split(/\s+/).filter(Boolean);

                return (
                  <button
                    key={i}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => handleLineClick(line.time)}
                    className="w-full text-left select-none group"
                    style={{
                      padding: isActive ? "12px 8px 16px" : "6px 8px",
                    }}
                  >
                    {isActive ? (
                      <span
                        className="flex flex-wrap leading-tight font-bold tracking-tight"
                        style={{ fontSize: "clamp(20px, 4.8vw, 26px)", gap: "0 0.28em" }}
                      >
                        {words.map((word, wIdx) => {
                          const act = wordActivations[wIdx] ?? 0;
                          // Opacity curve: upcoming=0.20, sung=0.45, active=1.0
                          const opacity = act > 0.55
                            ? 0.45 + (act - 0.55) * 1.22 // 0.45 → 1.0
                            : act > 0.1
                            ? 0.45 // sung
                            : 0.20 + act * 1.5; // upcoming
                          const scale = act > 0.65 ? 1 + (act - 0.65) * 0.12 : 1.0;
                          const glowStrength = Math.max(0, act - 0.68) / 0.32; // only glow when actively sung

                          return (
                            <span
                              key={wIdx}
                              style={{
                                display: "inline-block",
                                color: "white",
                                opacity: Math.min(1, Math.max(0.18, opacity)),
                                transform: `scale(${scale})`,
                                transformOrigin: "left center",
                                textShadow: glowStrength > 0
                                  ? `0 0 ${glowStrength * 16}px rgba(255,255,255,${glowStrength * 0.85}), 0 0 ${glowStrength * 6}px rgba(255,255,255,${glowStrength * 0.5})`
                                  : "none",
                                transition:
                                  "opacity 140ms ease-out, transform 140ms ease-out, text-shadow 140ms ease-out",
                                willChange: "opacity, transform",
                              }}
                            >
                              {word}
                            </span>
                          );
                        })}
                      </span>
                    ) : (
                      /*
                       * Inactive lines — Apple Music style:
                       * - Much smaller font
                       * - Past lines very dim (18%), future slightly more visible (28%)
                       * - Single line, not split into words (no overhead)
                       * - Hover: slightly brighter so click-to-seek is discoverable
                       */
                      <span
                        className="block font-semibold leading-snug transition-opacity duration-300"
                        style={{
                          fontSize: "clamp(13px, 3.2vw, 15px)",
                          opacity: isPast ? 0.18 : 0.28,
                          color: "white",
                        }}
                      >
                        {line.text}
                      </span>
                    )}
                  </button>
                );
              })}

              <div style={{ height: "38vh" }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
