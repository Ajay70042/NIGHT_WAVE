import React from "react";
import { motion } from "framer-motion";
import { Heart, Play } from "lucide-react";
import { albumOf, fmt, usePlayer } from "../../lib/music";

export function Cover({ src, className = "" }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`object-cover shrink-0 select-none ${className}`}
    />
  );
}

export function Visualizer({ active, bars = 4 }) {
  return (
    <div className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={`viz-bar w-[2px] rounded-full bg-primary ${active ? "" : "paused"}`}
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

export function Section({ title, sub, children, action }) {
  return (
    <section className="mt-9">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="font-display text-[22px]">{title}</h2>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AlbumCard({ album, i = 0, onPlay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.04, 0.4) }}
      className="group w-full cursor-pointer"
      onClick={onPlay}
    >
      <div className="relative overflow-hidden rounded-xl shadow-art">
        <Cover
          src={album.cover}
          className="aspect-square w-full transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 card-scrim opacity-0 transition group-hover:opacity-100" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay();
          }}
          aria-label={`Play ${album.title}`}
          className="play-btn absolute bottom-3 right-3 grid size-10 translate-y-2 place-items-center rounded-full opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Play className="size-4 fill-current translate-x-px" />
        </button>
      </div>
      <p className="mt-3 text-sm truncate font-medium">{album.title}</p>
      <p className="text-xs text-muted-foreground truncate">
        {album.artist} {album.year ? `· ${album.year}` : ""}
      </p>
    </motion.div>
  );
}

export function TrackRow({ t, i, showAlbum = true, onSelect }) {
  const { currentId, playing, play, toggle, favs, toggleFav } = usePlayer();
  const active = currentId === t.id;
  const a = albumOf(t);

  const handleClick = () => {
    if (onSelect) {
      onSelect(t);
    } else {
      active ? toggle() : play(t.id);
    }
  };

  return (
    <div
      onDoubleClick={() => play(t.id)}
      onClick={handleClick}
      className={`group grid grid-cols-[28px_1fr_auto] md:grid-cols-[28px_1.4fr_1fr_auto_48px] items-center gap-4 rounded-lg px-3 py-2 cursor-pointer transition hover:bg-secondary/50 ${
        active ? "bg-secondary/40" : ""
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          active ? toggle() : play(t.id);
        }}
        aria-label="Play"
        className="text-xs tabular-nums text-muted-foreground"
      >
        {active && playing ? (
          <Visualizer active />
        ) : (
          <>
            <span className="group-hover:hidden">{String(i + 1).padStart(2, "0")}</span>
            <Play className="hidden size-3.5 fill-current group-hover:block" />
          </>
        )}
      </button>

      <div className="flex min-w-0 items-center gap-3">
        <Cover src={a.cover || t.cover} className="size-10 rounded-md" />
        <div className="min-w-0">
          <p className={`text-sm truncate font-medium ${active ? "text-primary" : ""}`}>
            {t.title}
          </p>
          <p className="text-xs text-muted-foreground truncate">{t.artist}</p>
        </div>
      </div>

      {showAlbum && (
        <p className="hidden md:block text-xs text-muted-foreground truncate">{a.title}</p>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFav(t.id);
        }}
        aria-label="Favourite"
        className={`icon-btn ${favs.includes(t.id) ? "" : "md:opacity-0 group-hover:opacity-100"}`}
      >
        <Heart
          className={`size-3.5 ${favs.includes(t.id) ? "fill-primary text-primary" : ""}`}
        />
      </button>

      <span className="hidden md:block text-right text-xs tabular-nums text-muted-foreground">
        {fmt(t.duration)}
      </span>
    </div>
  );
}
