import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Heart } from "lucide-react";
import { create } from "zustand";
import { ImmControls } from "./ImmControls";
import { ModeDock } from "./ModeDock";
import { useIdleChrome } from "../../hooks/use-idle-chrome";
import { albumOf, trackById, usePlayer, getHighResArt } from "../../lib/music";

const getSavedImmMode = () => {
  try {
    return localStorage.getItem("sonara:imm_mode") === "lyrics" ? "lyrics" : "full";
  } catch {
    return "full";
  }
};

export const useFull = create((set) => ({
  open: false,
  visual: false,
  lastMode: getSavedImmMode(),
  setLastMode: (lastMode) => {
    try {
      localStorage.setItem("sonara:imm_mode", lastMode);
    } catch {}
    set({ lastMode });
  },
  set: (open) => {
    if (open) {
      try {
        localStorage.setItem("sonara:imm_mode", "full");
      } catch {}
      set({ open, lastMode: "full" });
    } else {
      set({ open });
    }
  },
  setVisual: (visual) => set({ visual }),
}));

export function FullPlayer() {
  const { open, set } = useFull();
  const chrome = useIdleChrome(2600, open);
  const s = usePlayer();
  const t = trackById(s.currentId);
  const a = albumOf(t);
  const fav = t ? s.favs.includes(t.id) : false;

  useEffect(() => {
    const k = (e) => {
      if (!open) return;
      if (e.key === "Escape") set(false);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, set]);

  const idle = !chrome;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={`fp-root fixed inset-0 z-50 overflow-hidden bg-background ${
            s.playing ? "fp-on" : ""
          }`}
          style={{ "--h": a.hue || 280 }}
        >
          <AnimatePresence>
            <motion.img
              key={a.id || a.cover}
              src={getHighResArt(a.cover)}
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: idle ? 0.42 : 0.58 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="fp-bg absolute inset-0 size-full object-cover"
            />
          </AnimatePresence>
          <motion.div
            animate={{ opacity: idle ? 0.95 : 0.78 }}
            transition={{ duration: 0.4 }}
            className="fp-veil absolute inset-0"
          />
          <div className="fp-aurora left-[-10%] top-[-15%]" />
          <div className="fp-aurora bottom-[-20%] right-[-10%]" style={{ animationDelay: "-7s" }} />

          <div className="relative flex h-full flex-col px-8 py-5">
            {/* Top header bar — hides when idle */}
            <motion.div
              animate={{ opacity: chrome ? 1 : 0, y: chrome ? 0 : -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ pointerEvents: chrome ? "auto" : "none" }}
              className="flex items-center justify-between"
            >
              <button
                onClick={() => t && s.toggleFav(t.id)}
                aria-label="Favourite"
                className="icon-btn"
              >
                <Heart className={`size-5 ${fav ? "fill-primary text-primary" : ""}`} />
              </button>
              <p className="label">Now playing · {a.title}</p>
              <span className="size-9" />
            </motion.div>

            {/* Centered Artwork + Name Below */}
            <div className="mx-auto flex w-full max-w-2xl min-h-0 flex-1 flex-col items-center justify-center text-center">
              <motion.div
                animate={{
                  scale: idle ? 1.12 : s.playing ? 1 : 0.96,
                  y: idle ? 16 : 0,
                  rotate: s.playing ? 0 : -1.5,
                }}
                transition={{ type: "spring", stiffness: 160, damping: 22 }}
                style={{ willChange: "transform" }}
                className="fp-art lift relative aspect-square w-[min(48vw,38vh)] overflow-hidden rounded-3xl"
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={a.id || a.cover}
                    src={getHighResArt(a.cover)}
                    alt={`${a.title} cover`}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="size-full object-cover"
                  />
                </AnimatePresence>
              </motion.div>

              <motion.div
                animate={{ y: idle ? 26 : 0, scale: idle ? 1.06 : 1 }}
                transition={{ type: "spring", stiffness: 160, damping: 22 }}
                className="mt-7 w-full px-4"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={t?.id || "empty"}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <h2
                      className={`font-display text-3xl sm:text-4xl lg:text-5xl leading-tight truncate ${
                        s.playing ? "title-pulse" : ""
                      }`}
                    >
                      {(t?.title || "Murgichor").split(" ").map((w, i) => (
                        <span
                          key={i}
                          className={i === 0 ? "title-outline" : "italic text-primary"}
                        >
                          {w}{" "}
                        </span>
                      ))}
                    </h2>
                    <div className="mt-2.5 flex items-center justify-center gap-3">
                      <span className="fp-eq" aria-hidden>
                        {Array.from({ length: 5 }, (_, i) => (
                          <span
                            key={i}
                            style={{
                              "--d": `${i * 140}ms`,
                              "--s": `${0.6 + (i % 3) * 0.18}s`,
                            }}
                          />
                        ))}
                      </span>
                      <p className="text-sm text-muted-foreground truncate">
                        {t?.artist || "Murgichor"}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Playbar — hides when idle, appears on mouse move/hover */}
            <motion.div
              animate={{ opacity: chrome ? 1 : 0, y: chrome ? 0 : 14 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{ pointerEvents: chrome ? "auto" : "none" }}
            >
              <ImmControls className="mx-auto w-full max-w-md" />
            </motion.div>
          </div>

          <motion.button
            onClick={() => set(false)}
            aria-label="Close full screen"
            title="Close (Esc / F)"
            animate={{ opacity: chrome ? 1 : 0, y: chrome ? 0 : -10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ pointerEvents: chrome ? "auto" : "none" }}
            className="icon-btn surface absolute right-6 top-6 z-20 grid size-9 place-items-center rounded-full cursor-pointer"
          >
            <X className="size-4" />
          </motion.button>
          <ModeDock mode="full" visible={chrome} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
