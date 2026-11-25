import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, CornerDownLeft, Search, Trash2, X } from "lucide-react";
import { fmt, trackById, usePlayer, registerTracks } from "../../lib/music";
import { flatten, moods, openHit, recentAlbums, searchAll } from "../../lib/search";
import { searchTracks } from "../../lib/api";
import { Cover } from "./ui";

const groupLabel = {
  track: "Songs",
  album: "Albums",
  artist: "Artists",
  playlist: "Playlists",
};

const HISTORY_KEY = "sonara:search_history";
const MAX_HISTORY = 20;

function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {}
}

function addToHistory(term, hit) {
  const realTitle = hit?.title?.trim() || term.trim();
  if (!realTitle) return;
  const existing = getHistory().filter(
    (h) => (h.trackTitle || h.term).toLowerCase() !== realTitle.toLowerCase()
  );
  const entry = {
    term: realTitle,
    timestamp: Date.now(),
    trackId: hit?.id ?? null,
    trackTitle: realTitle,
    artist: hit?.sub ?? null,
    thumbnail: hit?.cover ?? null,
  };
  saveHistory([entry, ...existing]);
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {}
}

export function SearchBar() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [history, setHistory] = useState(getHistory);
  const box = useRef(null);
  const input = useRef(null);
  const playing = usePlayer((s) => s.playing);

  const localResults = useMemo(() => searchAll(q), [q]);
  const [hits, setHits] = useState([]);

  // Sync hits from local search first
  useEffect(() => {
    setHits(flatten(localResults));
  }, [localResults]);

  // Debounced online search
  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) return;
    const timeout = setTimeout(async () => {
      setIsSearchingOnline(true);
      try {
        const onlineTracks = await searchTracks(q.trim());
        if (onlineTracks && onlineTracks.length > 0) {
          registerTracks(onlineTracks);
          const updated = searchAll(q);
          setHits(flatten(updated));
        }
      } catch (e) {
        console.warn("Online search:", e);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [q]);

  useEffect(() => setActive(0), [q]);

  // Reload history when panel opens
  useEffect(() => {
    if (open) setHistory(getHistory());
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable;
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen(true);
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (h) => {
    addToHistory(q || h.title, h);
    setHistory(getHistory());
    openHit(h);
    setOpen(false);
    input.current?.blur();
  };

  const pickHistoryTerm = (h) => {
    const label = h.trackTitle || h.term;
    setQ(label);
    if (h.trackId && trackById(h.trackId)) {
      usePlayer.getState().play(h.trackId);
      setOpen(false);
      input.current?.blur();
    } else {
      input.current?.focus();
    }
  };

  const removeHistoryEntry = (term, e) => {
    e.stopPropagation();
    const updated = getHistory().filter((h) => h.term !== term);
    saveHistory(updated);
    setHistory(updated);
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hits.length) setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hits.length) setActive((a) => (a - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      const h = hits[active];
      if (h) {
        e.preventDefault();
        pick(h);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      input.current?.blur();
    }
  };

  const blank = !q.trim();

  return (
    <div ref={box} className="relative w-full max-w-2xl mx-auto">
      {/* Search shell — wider, taller */}
      <div className="search-shell" style={{ padding: "10px 14px", gap: "10px" }}>
        <span className={`search-orb ${playing && !blank ? "on" : ""}`} aria-hidden />
        <Search className="relative size-5 shrink-0 text-muted-foreground" strokeWidth={1.6} />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          aria-label="Search songs, artists and albums"
          placeholder="Search songs, artists, albums…"
          className="relative min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
        />
        {blank ? (
          <span className="search-kbd relative hidden sm:block">K</span>
        ) : (
          <button
            onClick={() => {
              setQ("");
              input.current?.focus();
            }}
            aria-label="Clear"
            className="icon-btn relative"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="search-pop absolute inset-x-0 top-14 z-50 max-h-[70vh] overflow-y-auto p-2"
          >
            {blank ? (
              <>
                {/* Search History */}
                {history.length > 0 && (
                  <div className="p-3 pb-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="label">Recent Searches</p>
                      <button
                        onClick={handleClearHistory}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Trash2 className="size-3" />
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-col gap-0.5 mb-3">
                      {history.slice(0, 8).map((h) => (
                        <button
                          key={h.term + h.timestamp}
                          onClick={() => pickHistoryTerm(h)}
                          className="flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-secondary/70 transition group"
                        >
                          {h.thumbnail ? (
                            <Cover src={h.thumbnail} className="size-8 rounded-md shrink-0" />
                          ) : (
                            <span className="size-8 flex items-center justify-center rounded-md bg-secondary shrink-0">
                              <Clock className="size-3.5 text-muted-foreground" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm">{h.trackTitle || h.term}</p>
                            {h.artist && (
                              <p className="truncate text-xs text-muted-foreground">{h.artist}</p>
                            )}
                          </div>
                          <button
                            onClick={(e) => removeHistoryEntry(h.term, e)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity icon-btn"
                            aria-label="Remove"
                          >
                            <X className="size-3" />
                          </button>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mood shortcuts */}
                <div className="p-3 pt-0">
                  <p className="label mb-2.5">Moods</p>
                  <div className="grid grid-cols-2 gap-2">
                    {moods.map((m) => (
                      <button
                        key={m.name}
                        onClick={() => {
                          setQ(m.name);
                          input.current?.focus();
                        }}
                        className="surface flex items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-secondary/70"
                      >
                        <span className="font-display text-sm">{m.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : hits.length > 0 ? (
              <div className="flex flex-col gap-0.5">
                {hits.map((h, i) => {
                  const isAct = i === active;
                  return (
                    <button
                      key={h.kind + h.id + i}
                      onClick={() => pick(h)}
                      onMouseEnter={() => setActive(i)}
                      className={`search-row ${isAct ? "search-row-active" : ""}`}
                    >
                      <Cover src={h.cover} className="size-9 rounded-md" />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm ${isAct ? "text-primary" : ""}`}>
                          {h.title}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{h.sub}</p>
                      </div>
                      <span className="label text-[9px]">{groupLabel[h.kind]}</span>
                      {isAct && <CornerDownLeft className="size-3 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {isSearchingOnline ? "Searching music..." : `No results for "${q}"`}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
