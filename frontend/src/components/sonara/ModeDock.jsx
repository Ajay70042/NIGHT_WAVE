import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListOrdered, Maximize2, MicVocal } from "lucide-react";
import { useNavigate } from "../../lib/router";
import { albumOf, trackById, usePlayer } from "../../lib/music";
import { Cover } from "./ui";
import { useFull } from "./FullPlayer";

export function ModeDock({ mode, visible = true }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(false);
  const dockRef = useRef(null);
  const { queue, playFromQueue } = usePlayer();

  // Close queue when tapping outside in flat space
  useEffect(() => {
    if (!q) return;
    const onDown = (e) => {
      if (dockRef.current && !dockRef.current.contains(e.target)) {
        setQ(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [q]);

  // L or Q shortcut toggles queue in Full Screen / Lyrics mode
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if (isTyping || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "l" || key === "q") {
        e.preventDefault();
        setQ((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const items = [
    {
      id: "lyrics",
      label: "Lyrics mode",
      icon: MicVocal,
      on: () => {
        if (mode === "lyrics") return;
        useFull.getState().setLastMode("lyrics");
        navigate({ to: "/lyrics" });
        requestAnimationFrame(() => useFull.getState().set(false));
      },
    },
    {
      id: "full",
      label: "Full screen mode",
      icon: Maximize2,
      on: () => {
        useFull.getState().setLastMode("full");
        if (mode !== "full") {
          useFull.getState().set(true);
          if (mode === "lyrics") {
            requestAnimationFrame(() => navigate({ to: "/" }));
          }
        }
      },
    },
  ];

  return (
    <motion.div
      ref={dockRef}
      animate={{ opacity: visible || q ? 1 : 0, y: visible || q ? 0 : 10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ pointerEvents: visible || q ? "auto" : "none" }}
      className="absolute bottom-6 right-6 z-30 flex flex-col items-end gap-2"
    >
      <AnimatePresence>
        {q && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="elevated w-72 max-h-80 overflow-y-auto scrollbar-none rounded-2xl p-2"
          >
            <p className="label px-2 py-1">Up next · {queue.length}</p>
            {queue.map((id) => {
              const t = trackById(id);
              if (!t) return null;
              return (
                <button
                  key={id}
                  onClick={() => playFromQueue(id)}
                  className="flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-secondary/60 cursor-pointer"
                >
                  <Cover src={albumOf(t).cover} className="size-8 rounded-md" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{t.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.artist}</span>
                  </span>
                </button>
              );
            })}
            {!queue.length && (
              <p className="px-2 py-2 text-sm text-muted-foreground">Queue is empty</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="elevated flex items-center gap-1 rounded-full p-1">
        {items.map(({ id, label, icon: I, on }) => (
          <button
            key={id}
            onClick={on}
            aria-label={label}
            title={label}
            className={`icon-btn grid size-8 place-items-center rounded-full ${
              mode === id ? "bg-secondary text-primary" : ""
            }`}
          >
            <I className="size-4" />
          </button>
        ))}
        <button
          onClick={() => setQ((v) => !v)}
          aria-label="Queue"
          title="Queue"
          className={`icon-btn grid size-8 place-items-center rounded-full ${
            q ? "bg-secondary text-primary" : ""
          }`}
        >
          <ListOrdered className="size-4" />
        </button>
      </div>
    </motion.div>
  );
}
