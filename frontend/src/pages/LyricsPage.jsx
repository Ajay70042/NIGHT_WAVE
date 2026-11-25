import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "../lib/router";
import { useIdleChrome } from "../hooks/use-idle-chrome";
import { albumOf, trackById, usePlayer, getHighResArt } from "../lib/music";
import { ImmControls } from "../components/sonara/ImmControls";
import { ModeDock } from "../components/sonara/ModeDock";
import { Cover } from "../components/sonara/ui";
import { useFull } from "../components/sonara/FullPlayer";

export function LyricsPage() {
  const { currentId, time, exactTime, duration, seek, currentLyrics } = usePlayer();
  const t = trackById(currentId);
  const a = albumOf(t);
  const router = useRouter();
  const chrome = useIdleChrome();
  const idle = !chrome;

  useEffect(() => {
    useFull.getState().setLastMode("lyrics");
  }, []);

  const close = () => {
    router.history.back();
  };

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const activeTime = exactTime || time || 0;
  const rawLines = currentLyrics?.lines || [];
  const hasLyrics = Array.isArray(rawLines) && rawLines.length > 0;
  const hasTimestamps = hasLyrics && typeof rawLines[0] === "object" && "time" in rawLines[0];

  const lines = hasLyrics
    ? rawLines.map((l) => (typeof l === "string" ? l : l.text || l.words || ""))
    : [];

  let cur = 0;
  if (hasLyrics) {
    if (hasTimestamps) {
      let foundIdx = 0;
      const tWithOffset = activeTime + 0.15;
      for (let i = 0; i < rawLines.length; i++) {
        if (tWithOffset >= rawLines[i].time) foundIdx = i;
        else break;
      }
      cur = foundIdx;
    } else {
      const dur = duration || t?.duration || 200;
      const per = dur / lines.length;
      cur = Math.min(lines.length - 1, Math.max(0, Math.floor(activeTime / per)));
    }
  }

  const refs = useRef([]);
  useEffect(() => {
    refs.current[cur]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [cur]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-40 bg-background"
    >
      <div className="ambient" />
      <motion.img
        src={getHighResArt(a.cover)}
        alt=""
        aria-hidden
        animate={{ opacity: idle ? 0.28 : 0.4 }}
        transition={{ duration: 0.45 }}
        className="lyrics-bg pointer-events-none absolute inset-0 size-full object-cover"
      />
      <motion.div
        animate={{ opacity: idle ? 0.92 : 0.72 }}
        transition={{ duration: 0.45 }}
        className="lyrics-veil pointer-events-none absolute inset-0"
      />

      <div className="relative mx-auto grid h-full max-w-6xl items-center md:grid-cols-[340px_1fr] gap-16 px-10">
        {/* Left: Album Art + Song Name (scales bigger when idle) + Playbar (hides when idle) */}
        <div className="hidden md:flex flex-col justify-center self-center py-6">
          <motion.div
            animate={{ scale: idle ? 1.08 : 1, y: idle ? 12 : 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 22 }}
            style={{ willChange: "transform" }}
            className="origin-left"
          >
            <div className="lift aspect-square w-full overflow-hidden rounded-2xl">
              <Cover src={getHighResArt(a.cover)} className="size-full" />
            </div>
            <p className={`font-display mt-6 truncate transition-all duration-300 ${idle ? "text-3xl" : "text-2xl"}`}>
              {t?.title || "No Track"}
            </p>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {t?.artist || "Murgichor"}
            </p>
          </motion.div>

          <motion.div
            animate={{ opacity: chrome ? 1 : 0, y: chrome ? 0 : 10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ pointerEvents: chrome ? "auto" : "none" }}
          >
            <ImmControls className="mt-5" />
          </motion.div>
        </div>

        {/* Right: Lyrics (shifted a bit further right, always visible even when idle) */}
        <div className="lyrics-mask h-screen overflow-y-auto scrollbar-none py-[40vh] pl-6 pr-10 md:pl-20 md:pr-12">
          {!hasLyrics ? (
            <div className="py-12 text-muted-foreground font-display text-2xl">
              {t ? "No synced lyrics available for this track." : "Play a song to view lyrics."}
            </div>
          ) : (
            lines.map((l, i) => {
              const d = Math.abs(i - cur);
              return (
                <motion.button
                  key={i}
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  onClick={() => {
                    if (hasTimestamps) {
                      seek(Number(rawLines[i].time) || 0, true);
                    } else {
                      const dur = duration || t?.duration || 200;
                      const per = dur / lines.length;
                      seek(i * per, true);
                    }
                  }}
                  animate={{
                    opacity: d === 0 ? 1 : d === 1 ? 0.45 : 0.18,
                    scale: d === 0 ? 1.06 : d === 1 ? 0.95 : 0.9,
                  }}
                  transition={{
                    default: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
                    scale: { type: "spring", stiffness: 260, damping: 24 },
                  }}
                  style={{ willChange: "transform, opacity" }}
                  className="lyric-line block w-full origin-left py-3 text-left font-display text-3xl md:text-5xl leading-tight cursor-pointer hover:opacity-90"
                >
                  <span className="relative block">
                    <span className="block text-muted-foreground">{l}</span>
                    <motion.span
                      aria-hidden
                      className="lyric-tint absolute inset-0 block"
                      animate={{ opacity: d === 0 ? 1 : 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {l}
                    </motion.span>
                  </span>
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      <motion.button
        onClick={close}
        aria-label="Close lyrics"
        title="Close (Esc / F)"
        animate={{ opacity: chrome ? 1 : 0, y: chrome ? 0 : -10 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ pointerEvents: chrome ? "auto" : "none" }}
        className="icon-btn surface absolute right-6 top-6 z-20 grid size-9 place-items-center rounded-full cursor-pointer"
      >
        <X className="size-4" />
      </motion.button>

      <ModeDock mode="lyrics" visible={chrome} />
    </motion.div>
  );
}
