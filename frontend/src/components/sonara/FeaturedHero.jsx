import React from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Pause, Play, Shuffle } from "lucide-react";
import { albumOf, fmt, trackById, tracks, usePlayer } from "../../lib/music";
import { Dancer } from "./Dancer";
import { Visualizer } from "./ui";
import { useFull } from "./FullPlayer";

export function FeaturedHero({ onShuffle, onPlay }) {
  const { currentId, playing, toggle, play, queue, time } = usePlayer();
  const openFull = useFull((f) => f.set);
  const resume = !playing && time > 0;
  const upNext = queue.slice(0, 3).map(trackById).filter(Boolean);
  const cur = trackById(currentId);
  const feat = albumOf(cur);
  const isFeatPlaying = playing;
  const title = cur ? cur.title : "Murgichor";
  const artist = cur ? cur.artist : "Connect & stream your YouTube Music";
  const words = title.split(" ");
  const mx = useMotionValue(0), my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 120, damping: 16 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 120, damping: 16 });
  const glowX = useTransform(mx, [-0.5, 0.5], ["30%", "70%"]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      className="hero-stage hero-compact @container relative mt-6 overflow-hidden rounded-2xl"
    >
      <img src={feat.cover} alt="" className="hero-bg absolute inset-0 size-full object-cover" />
      <motion.div className="hero-spot absolute inset-0" style={{ "--gx": glowX }} />
      <div className="hero-grid absolute inset-0" />

      <div className="relative flex flex-col gap-5 p-5 @lg:flex-row @lg:items-center @lg:gap-6 @lg:p-5">
        <motion.div
          onClick={() => cur && openFull(true)}
          role="button"
          aria-label="Open full screen player"
          title="Open full screen"
          className="relative order-1 mx-auto aspect-square w-28 shrink-0 cursor-pointer @lg:mx-0 @lg:w-36"
          style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
        >
          <motion.div
            className={`vinyl-disc absolute inset-[6%] rounded-full ${
              isFeatPlaying ? "spinning" : ""
            }`}
            animate={{ x: isFeatPlaying ? "12%" : "5%" }}
            transition={{ type: "spring", stiffness: 80, damping: 15 }}
          >
            <img
              src={feat.cover}
              alt=""
              className="absolute inset-[34%] rounded-full object-cover"
            />
          </motion.div>
          <img
            src={feat.cover}
            alt={`${feat.title} cover`}
            className="sleeve relative size-full rounded-xl object-cover"
          />
        </motion.div>

        <div className="order-2 min-w-0 flex-1 @lg:pl-5 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="hero-tag">
                {playing ? "Now playing" : resume ? "Continue listening" : "Featured"} · {feat.title}
              </span>
              {isFeatPlaying && <Visualizer active bars={5} />}
            </div>

            <AnimatePresence mode="wait">
              <motion.h2
                key={cur?.id || "default"}
                exit={{ opacity: 0, filter: "blur(6px)" }}
                transition={{ duration: 0.3 }}
                className={`font-display mt-2 truncate text-2xl leading-[1.08] @lg:text-[1.85rem] @2xl:text-4xl ${
                  playing ? "title-pulse" : ""
                }`}
              >
                {words.map((w, i) => (
                  <motion.span
                    key={w + i}
                    className={`inline ${
                      i === 0 && words.length > 1
                        ? "title-outline"
                        : i > 0
                        ? "italic text-primary"
                        : ""
                    }`}
                    initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    transition={{ delay: 0.06 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {w}{" "}
                  </motion.span>
                ))}
              </motion.h2>
            </AnimatePresence>

            <p className="mt-1.5 truncate text-xs text-muted-foreground">
              <span className="text-foreground">{artist}</span> {feat.year ? `· ${feat.year}` : ""}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (cur) toggle();
                  else if (onPlay) onPlay();
                }}
                className="btn-primary !px-4 !py-2.5 !text-[.8rem]"
              >
                {isFeatPlaying ? (
                  <Pause className="size-3.5 fill-current" />
                ) : (
                  <Play className="size-3.5 fill-current" />
                )}{" "}
                {isFeatPlaying ? "Pause" : resume ? `Resume · ${fmt(time)}` : "Play"}
              </motion.button>
              <button
                onClick={onShuffle}
                className="btn-ghost !px-4 !py-2.5 !text-[.8rem]"
              >
                <Shuffle className="size-3.5" /> Shuffle
              </button>
            </div>
          </div>

          <div className="shrink-0 self-end pr-1">
            <Dancer playing={playing} seed={cur?.id || "0"} />
          </div>
        </div>

        {upNext.length > 0 && (
          <div className="order-3 shrink-0 border-hairline @2xl:w-52 @2xl:border-l @2xl:pl-4">
            <p className="label mb-2">Up next</p>
            <div className="flex flex-col gap-0.5">
              {upNext.map((t) => (
                <button
                  key={t.id}
                  onClick={() => play(t.id)}
                  className="group flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-foreground/5"
                >
                  <img
                    src={albumOf(t).cover}
                    alt=""
                    className="size-7 shrink-0 rounded-md object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{t.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {t.artist}
                    </span>
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {fmt(t.duration)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
