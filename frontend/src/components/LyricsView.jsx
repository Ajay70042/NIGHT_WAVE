/**
 * LyricsView — real-time synced scrolling lyrics overlay.
 * Auto-scrolls active line to center; interactive click-to-seek karaoke panel.
 */
import { useEffect, useRef } from "react";
import { X, Mic2, Loader2, Music, Sparkles } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";

export default function LyricsView({ seek }) {
  const { isLyricsOpen, toggleLyrics, lyrics, lyricsLoading, progress, currentTrack } =
    usePlayerStore();

  const containerRef = useRef(null);
  const activeLineRef = useRef(null);

  // Find active line index (last line whose time <= current progress)
  const getActiveLine = () => {
    if (!lyrics?.synced || !lyrics.lines || lyrics.lines.length === 0) return -1;
    let idx = 0;
    for (let i = 0; i < lyrics.lines.length; i++) {
      if (lyrics.lines[i].time <= progress) idx = i;
      else break;
    }
    return idx;
  };

  const activeIdx = getActiveLine();

  // Auto-scroll active line into center smoothly
  useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeLineRef.current;
      const offset = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({ top: offset, behavior: "smooth" });
    }
  }, [activeIdx]);

  const handleLineClick = (time) => {
    if (seek && typeof time === "number") {
      seek(time);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isLyricsOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={toggleLyrics} />
      )}

      {/* Panel */}
      <div
        className={`
          fixed top-0 right-0 bottom-[100px] z-40 w-full sm:w-96
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
          <div className="px-5 py-2.5 border-b border-white/[0.04] bg-white/[0.01]">
            <p className="text-xs font-medium text-white/80 truncate">{currentTrack.title}</p>
            <p className="text-[11px] text-white/40 truncate">{currentTrack.artist || "Unknown Artist"}</p>
          </div>
        )}

        {/* Content */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto px-5 py-6 select-none"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
        >
          {/* Loading */}
          {lyricsLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-sm">Finding synchronized lyrics…</p>
            </div>
          )}

          {/* Not found */}
          {!lyricsLoading && lyrics && !lyrics.synced && !lyrics.plain && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/25 text-center">
              <Music className="w-10 h-10 opacity-30 mx-auto" />
              <p className="text-sm font-medium">No lyrics available</p>
              <p className="text-xs text-white/20">Instrumental or unlisted track</p>
            </div>
          )}

          {/* No track selected */}
          {!lyricsLoading && !lyrics && !currentTrack && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-white/25 text-center">
              <Mic2 className="w-10 h-10 opacity-30 mx-auto" />
              <p className="text-sm">Play a track to view live lyrics</p>
            </div>
          )}

          {/* Plain text fallback (if ever unsynced) */}
          {!lyricsLoading && lyrics?.plain && !lyrics?.synced && (
            <pre className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed font-sans text-center py-8">
              {lyrics.plain}
            </pre>
          )}

          {/* Synced lyrics (Karaoke mode) */}
          {!lyricsLoading && lyrics?.synced && lyrics.lines && (
            <div className="flex flex-col gap-1.5 pb-36">
              {/* Top spacer so first line centers */}
              <div style={{ height: "35vh" }} />

              {lyrics.lines.map((line, i) => {
                const isActive = i === activeIdx;
                const isPast = i < activeIdx;

                return (
                  <button
                    key={i}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => handleLineClick(line.time)}
                    className={`
                      w-full text-left py-2 px-3 rounded-xl transition-all duration-300 ease-out group text-left
                      ${isActive
                        ? "text-white text-[19px] leading-snug font-bold scale-[1.03] text-glow-lime bg-white/[0.04]"
                        : isPast
                        ? "text-white/20 text-[16px] font-medium hover:text-white/50"
                        : "text-white/40 text-[16px] font-medium hover:text-white/70"
                      }
                    `}
                    style={{
                      transformOrigin: "left center",
                    }}
                  >
                    <span className="block">{line.text}</span>
                  </button>
                );
              })}

              {/* Bottom spacer */}
              <div style={{ height: "35vh" }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
