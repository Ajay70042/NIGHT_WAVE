import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { Pause, Play, SkipForward, X } from "lucide-react";
import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { albumOf, trackById, usePlayer } from "../../lib/music";
import { Cover } from "./ui";

export const useMini = create((set) => ({
  open: false,
  size: "m",
  set: (open) => set({ open }),
  setSize: (size) => set({ size }),
}));

const SIZES = {
  s: { line: 20, next: 13, w: 340 },
  m: { line: 28, next: 16, w: 460 },
  l: { line: 44, next: 21, w: 640 },
};

const getTauriInvoke = () =>
  typeof window !== "undefined"
    ? window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke
    : null;

function getSyncedLyrics(currentLyrics, activeTime, duration) {
  const rawLines = currentLyrics?.lines || [];
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { lines: [], idx: -1 };
  }
  const hasTimestamps = typeof rawLines[0] === "object" && "time" in rawLines[0];
  const lines = rawLines.map((l) => (typeof l === "string" ? l : l.text || l.words || ""));

  let idx = 0;
  if (hasTimestamps) {
    const tWithOffset = activeTime + 0.15;
    for (let k = 0; k < rawLines.length; k++) {
      if (tWithOffset >= rawLines[k].time) idx = k;
      else break;
    }
  } else {
    const dur = duration || 200;
    const per = dur / lines.length;
    idx = Math.min(lines.length - 1, Math.max(0, Math.floor(activeTime / per)));
  }

  return { lines, idx };
}

function Card({ state, onToggle, onNext, onClose, onDragStart }) {
  const { size, setSize } = useMini();
  const [hover, setHover] = useState(false);
  const lineRefs = useRef([]);

  const { title, artist, cover, currentId, activeTime, duration, playing, currentLyrics } = state;
  const { lines, idx } = getSyncedLyrics(currentLyrics, activeTime, duration);

  useEffect(() => {
    if (idx >= 0 && lineRefs.current[idx]) {
      lineRefs.current[idx].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [idx, currentId, size]);

  const z = SIZES[size];
  const show = hover;
  const rainbowStyle = {
    backgroundImage:
      "linear-gradient(90deg, #ff5e8a, #ffb84d, #5ef29c, #4dc3ff, #b975ff, #ff5e8a)",
    backgroundSize: "200% 100%",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    animation: "lyric-shift 5s linear infinite",
    filter: "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.92))",
  };
  const sideStyle = {
    fontSize: z.next,
    color: "rgba(255, 255, 255, 0.95)",
    textShadow: "0 1px 4px rgba(0,0,0,0.95), 0 0 12px rgba(0,0,0,0.9)",
  };

  return (
    <div
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onMouseDown={onDragStart}
      className="mini-lyrics flex h-full w-full select-none flex-col justify-center gap-2 p-4 cursor-grab active:cursor-grabbing"
    >
      <motion.div
        animate={{ opacity: show ? 1 : 0, y: show ? 0 : -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{ pointerEvents: show ? "auto" : "none" }}
        className="flex items-center gap-2.5"
        data-testid="mini-controls"
      >
        {cover && <Cover src={cover} className="size-9 rounded-lg" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{title || "Murgichor"}</p>
          <p className="truncate text-[11px] text-muted-foreground">{artist || ""}</p>
        </div>
        <div className="flex items-center rounded-full text-[11px]">
          {["s", "m", "l"].map((k) => (
            <button
              key={k}
              onClick={() => setSize(k)}
              aria-label={`Text size ${k.toUpperCase()}`}
              aria-pressed={size === k}
              className={`icon-btn px-1.5 uppercase cursor-pointer ${size === k ? "text-primary" : ""}`}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          onClick={onToggle}
          aria-label={playing ? "Pause" : "Play"}
          className="icon-btn cursor-pointer"
        >
          {playing ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
        </button>
        <button onClick={onNext} aria-label="Next" className="icon-btn cursor-pointer">
          <SkipForward className="size-4 fill-current" />
        </button>
        <button
          onClick={onClose}
          aria-label="Close floating lyrics"
          className="icon-btn cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </motion.div>

      <div
        className="relative w-full overflow-y-auto scrollbar-none px-2 text-center"
        style={{
          maxHeight: Math.round(z.line * 2.8 + z.next * 4.8),
          maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
        }}
      >
        {lines.length === 0 ? (
          <p className="font-display py-4 leading-snug" style={{ ...rainbowStyle, fontSize: z.line }}>
            {title ? "No synced lyrics for this track" : "Play a track"}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-2 py-12">
            {lines.map((line, i) => {
              const dist = Math.abs(i - idx);
              const isCur = i === idx;
              const isNext = i === idx + 1;
              const targetOpacity = isCur ? 1 : isNext ? 0.92 : dist === 1 ? 0.78 : 0;
              return (
                <motion.p
                  key={`${currentId}-${i}`}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  animate={{
                    opacity: targetOpacity,
                    scale: isCur ? 1.03 : 0.96,
                  }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className={`w-full leading-snug whitespace-normal break-words ${
                    isCur ? "font-display" : "font-medium"
                  }`}
                  style={isCur ? { ...rainbowStyle, fontSize: z.line } : sideStyle}
                >
                  {line}
                </motion.p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Standalone transparent always-on-top desktop window (?floating=1) */
export function FloatingLyricsOverlay() {
  const [syncState, setSyncState] = useState({
    currentId: null,
    title: "Murgichor",
    artist: "",
    cover: "",
    hue: 280,
    activeTime: 0,
    duration: 200,
    playing: false,
    currentLyrics: null,
  });

  useEffect(() => {
    document.documentElement.classList.add("floating-window");
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const root = document.getElementById("root");
    if (root) root.style.background = "transparent";

    let unlisten = null;
    listen("lyrics-sync", (event) => {
      if (event?.payload) setSyncState(event.payload);
    }).then((fn) => {
      unlisten = fn;
      const invoke = getTauriInvoke();
      if (invoke) invoke("send_lyrics_action", { action: "request-sync" }).catch(() => {});
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const sendAction = (action) => {
    const invoke = getTauriInvoke();
    if (invoke) invoke("send_lyrics_action", { action }).catch(() => {});
  };

  const handleClose = () => {
    sendAction("close");
    const invoke = getTauriInvoke();
    if (invoke) invoke("close_floating_lyrics").catch(() => {});
  };

  const handleDragStart = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest("button, input, a")) return;
    const invoke = getTauriInvoke();
    if (invoke) invoke("window_start_dragging").catch(() => {});
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent text-foreground font-body">
      <Card
        state={syncState}
        onToggle={() => sendAction("toggle")}
        onNext={() => sendAction("next")}
        onClose={handleClose}
        onDragStart={handleDragStart}
      />
    </div>
  );
}

/** Main-window controller: opens system-wide floating window in Tauri & syncs live lyrics */
export function FloatingLyrics() {
  const open = useMini((s) => s.open);
  const size = useMini((s) => s.size);
  const { currentId, time, exactTime, duration, playing, toggle, next, currentLyrics } = usePlayer();
  const drag = useDragControls();
  const bounds = useRef(null);
  const isTauri = Boolean(getTauriInvoke());

  const buildPayload = () => {
    const st = usePlayer.getState();
    const t = trackById(st.currentId);
    const a = albumOf(t);
    return {
      currentId: st.currentId,
      title: t?.title || "Murgichor",
      artist: t?.artist || "",
      cover: a?.cover || "",
      hue: a?.hue || 280,
      activeTime: st.exactTime || st.time || 0,
      duration: st.duration || t?.duration || 200,
      playing: st.playing,
      currentLyrics: st.currentLyrics,
    };
  };

  // Open/close native always-on-top Tauri window when toggled
  useEffect(() => {
    const invoke = getTauriInvoke();
    if (!invoke) return;
    if (open) {
      invoke("open_floating_lyrics")
        .then(() => invoke("broadcast_lyrics_state", { payload: buildPayload() }))
        .catch(() => {});
    } else {
      invoke("close_floating_lyrics").catch(() => {});
    }
  }, [open]);

  // Listen for Play/Pause/Next/Close/RequestSync from the floating window
  useEffect(() => {
    if (!isTauri) return;
    let unlisten = null;
    listen("lyrics-action", (event) => {
      const action = event?.payload;
      if (action === "toggle") usePlayer.getState().toggle();
      else if (action === "next") usePlayer.getState().next();
      else if (action === "close") useMini.getState().set(false);
      else if (action === "request-sync") {
        const invoke = getTauriInvoke();
        if (invoke) invoke("broadcast_lyrics_state", { payload: buildPayload() }).catch(() => {});
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, [isTauri]);

  // Broadcast state to the floating window whenever lyrics/time/playback changes
  useEffect(() => {
    if (!open || !isTauri) return;
    const invoke = getTauriInvoke();
    if (invoke) invoke("broadcast_lyrics_state", { payload: buildPayload() }).catch(() => {});
  }, [open, isTauri, currentId, time, exactTime, duration, playing, currentLyrics]);

  // In Tauri, the native always-on-top window handles rendering outside the app
  if (isTauri) return null;

  // Browser fallback: in-app draggable card
  const t = trackById(currentId);
  const a = albumOf(t);
  const browserState = {
    currentId,
    title: t?.title || "Murgichor",
    artist: t?.artist || "",
    cover: a?.cover || "",
    hue: a?.hue || 280,
    activeTime: exactTime || time || 0,
    duration: duration || t?.duration || 200,
    playing,
    currentLyrics,
  };

  return (
    <div ref={bounds} className="pointer-events-none fixed inset-0 z-[60]">
      <AnimatePresence>
        {open && (
          <motion.div
            drag
            dragControls={drag}
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={bounds}
            whileDrag={{ cursor: "grabbing" }}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: SIZES[size].w, willChange: "transform, opacity" }}
            className="pointer-events-auto absolute bottom-28 right-8"
            role="dialog"
            aria-label="Floating lyrics"
          >
            <Card
              state={browserState}
              onToggle={toggle}
              onNext={next}
              onClose={() => useMini.getState().set(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
