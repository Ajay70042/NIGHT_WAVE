import React from "react";
import { motion } from "framer-motion";
import { useBeat } from "../../lib/audio";

const spring = { type: "spring", stiffness: 420, damping: 18 };

/** Line-art dancer driven by beats detected from the live audio output. */
export function Dancer({ playing, seed = "0" }) {
  const beat = useBeat((b) => b.beat);
  const level = useBeat((b) => b.level);
  const on = playing;
  const a = beat % 2 === 0;
  const numSeed =
    typeof seed === "number"
      ? seed
      : [...String(seed)].reduce((n, c) => n + c.charCodeAt(0), 0);
  const style = numSeed % 3;
  const k = on ? 1 : 0;

  const arms = on
    ? a
      ? ["M40 34 L26 44 L18 34", "M40 34 L56 26 L60 10"]
      : ["M40 34 L24 26 L20 10", "M40 34 L54 44 L62 34"]
    : ["M40 34 L30 48 L28 60", "M40 34 L50 48 L52 60"];

  const legs = on
    ? a
      ? ["M40 62 L30 80 L26 100", "M40 62 L52 78 L46 96"]
      : ["M40 62 L28 78 L34 96", "M40 62 L50 80 L54 100"]
    : ["M40 62 L33 82 L31 100", "M40 62 L47 82 L49 100"];

  return (
    <div className="relative grid h-24 w-20 shrink-0 place-items-end" aria-hidden>
      <motion.span
        key={beat}
        className="absolute bottom-0 left-1/2 h-2 w-16 -translate-x-1/2 rounded-full bg-primary/40 blur-sm"
        initial={on ? { scaleX: 1.6, opacity: 1 } : false}
        animate={{ scaleX: 1 + level * 0.35, opacity: on ? 0.35 + level * 0.45 : 0.2 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      <svg
        viewBox="0 0 80 110"
        className="relative h-full w-full overflow-visible text-foreground"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.g
          key={on ? "on" : "off"}
          style={{ originX: "40px", originY: "100px" }}
          initial={false}
          animate={{
            y: on ? (style === 0 ? -8 : -4) * (a ? 1 : 0.2) : 0,
            rotate: (style === 1 ? 8 : 3.5) * k * (a ? 1 : -1),
            x: style === 2 ? 4 * k * (a ? 1 : -1) : 0,
          }}
          transition={spring}
        >
          <motion.g
            animate={{ rotate: 10 * k * (a ? -1 : 1) }}
            transition={spring}
            style={{ originX: "40px", originY: "28px" }}
          >
            <circle cx={40} cy={16} r={9} className="fill-primary/25 stroke-primary" />
            <path d="M33 10 q7 -7 14 0" className="stroke-primary" />
          </motion.g>
          <path d="M40 26 L40 62" />
          {[...arms, ...legs].map((d, i) => (
            <motion.path key={i} animate={{ d }} transition={spring} />
          ))}
        </motion.g>
      </svg>
      {on && beat > 0 && beat % 4 === 0 && (
        <motion.span
          key={`n${beat}`}
          className="absolute top-2 left-[78%] text-xs text-primary"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -22, rotate: 15 }}
          transition={{ duration: 1.1 }}
        >
          ♪
        </motion.span>
      )}
    </div>
  );
}
