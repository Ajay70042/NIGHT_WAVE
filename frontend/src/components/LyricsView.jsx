/**
 * LyricsView — real-time synced scrolling lyrics overlay.
 * Auto-scrolls active line to center; glassmorphism panel.
 */
import { useEffect, useRef } from "react";
import { X, Mic2, Loader2, Music } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";

export default function LyricsView() {
  const { isLyricsOpen, toggleLyrics, lyrics, lyricsLoading, progress, currentTrack } =
    usePlayerStore();

  const containerRef = useRef(null);
  const activeLineRef = useRef(null);

  // Find active line index (last line whose time <= current progress)
  const getActiveLine = () => {
    if (!lyrics?.synced || !lyrics.lines) return -1;
    let idx = 0;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= progress) idx = i;
      else break;
    }
    return idx;
  };

  const activeIdx = getActiveLine();

  // Auto-scroll active line into center
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeLineRef.current;
      const offset = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({ top: offset, behavior: "smooth" });
    }
  }, [activeIdx]);

  return (
    <>
      {/* Backdrop */}
      {isLyricsOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={toggleLyrics} />
      )}

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 bottom-[100px] z-40 w-full sm:w-80
          glass-strong border-l border-white/[0.06]
          flex flex-col
          transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isLyricsOpen ? "translate-x-0" : "translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-white">Lyrics</h2>
            {lyrics?.synced && (
              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
                SYNCED
              </span>
            )}
          </div>
          <button onClick={toggleLyrics} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Track context */}
        {currentTrack && (
          <div className="px-5 py-2 border-b border-white/[0.04]">
            <p className="text-xs text-white/40 truncate">
              {currentTrack.title} — {currentTrack.artist}
            </p>
          </div>
        )}

        {/* Content */}
        <div ref={containerRef} className="flex-1 overflow-y-auto px-5 py-6">
          {/* Loading */}
          {lyricsLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-sm">Fetching lyrics…</p>
            </div>
          )}

          {/* Not found */}
          {!lyricsLoading && lyrics && !lyrics.synced && !lyrics.plain && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
              <Music className="w-10 h-10 opacity-30" />
              <p className="text-sm">No lyrics found</p>
              <p className="text-xs text-white/15">Try a different track</p>
            </div>
          )}

          {/* No track selected */}
          {!lyricsLoading && !lyrics && !currentTrack && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20">
              <Mic2 className="w-10 h-10 opacity-30" />
              <p className="text-sm">Play a track to see lyrics</p>
            </div>
          )}

          {/* Plain text lyrics */}
          {!lyricsLoading && lyrics?.plain && !lyrics?.synced && (
            <pre className="text-sm text-white/60 whitespace-pre-wrap leading-relaxed font-sans">
              {lyrics.plain}
            </pre>
          )}

          {/* Synced lyrics */}
          {!lyricsLoading && lyrics?.synced && lyrics.lines && (
            <div className="flex flex-col gap-1 pb-32">
              {/* Spacer above so first line can center */}
              <div style={{ height: "40vh" }} />

              {lyrics.lines.map((line, i) => {
                const isActive = i === activeIdx;
                const isPast = i < activeIdx;
                return (
                  <p
                    key={i}
                    ref={isActive ? activeLineRef : null}
                    className={`
                      text-lg leading-snug font-medium text-center
                      transition-all duration-300 ease-out
                      ${isActive
                        ? "text-white scale-105 text-glow-lime"
                        : isPast
                        ? "text-white/20 scale-100"
                        : "text-white/35 scale-100"
                      }
                    `}
                    style={{
                      transformOrigin: "center",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {line.text}
                  </p>
                );
              })}

              {/* Bottom spacer */}
              <div style={{ height: "40vh" }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
