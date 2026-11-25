import React from "react";
import { motion } from "framer-motion";
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { fmt, trackById, usePlayer } from "../../lib/music";

export function ImmControls({ className = "" }) {
  const s = usePlayer();
  const t = trackById(s.currentId);
  const dur = s.duration || t?.duration || 200;
  const pct = dur > 0 ? (s.time / dur) * 100 : 0;

  return (
    <div className={`relative ${className}`}>
      <div className="relative z-10 px-1 py-1.5">
        <div className="flex items-center gap-2.5 text-[11px] tabular-nums text-muted-foreground">
          <span className="w-8 text-right">{fmt(s.time)}</span>
          <input
            type="range"
            min={0}
            max={dur}
            value={s.time}
            onChange={(e) => s.seek(+e.target.value)}
            aria-label="Seek"
            className="range flex-1"
            style={{ "--p": `${pct}%` }}
          />
          <span className="w-8">-{fmt(Math.max(0, dur - s.time))}</span>
        </div>
        <div className="mt-1 flex items-center justify-center gap-6">
          <button
            onClick={s.toggleShuffle}
            aria-label="Shuffle"
            className={`icon-btn ${s.shuffle ? "text-primary" : ""}`}
          >
            <Shuffle className="size-[15px]" />
          </button>
          <button onClick={s.prev} aria-label="Previous" className="icon-btn">
            <SkipBack className="size-[15px] fill-current" />
          </button>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={s.toggle}
            aria-label={s.playing ? "Pause" : "Play"}
            className={`play-btn grid size-9 place-items-center rounded-full ${
              s.playing ? "ctl-pulse" : ""
            }`}
          >
            {s.playing ? (
              <Pause className="size-[15px] fill-current" />
            ) : (
              <Play className="size-[15px] fill-current translate-x-px" />
            )}
          </motion.button>
          <button onClick={s.next} aria-label="Next" className="icon-btn">
            <SkipForward className="size-[15px] fill-current" />
          </button>
          <button
            onClick={s.cycleRepeat}
            aria-label="Repeat"
            className={`icon-btn ${s.repeat !== "off" ? "text-primary" : ""}`}
          >
            {s.repeat === "one" ? (
              <Repeat1 className="size-[15px]" />
            ) : (
              <Repeat className="size-[15px]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
