/**
 * SearchModal — Ctrl+K / "/" overlay with live search, history, and results.
 * Debounced 350ms, shows recent searches, quick suggestions, and up to 20 live results.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, Music, History, Sparkles, Trash2, ArrowUpRight } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import { searchTracks } from "../lib/api";
import TrackCard from "./TrackCard";

const QUICK_TRENDING = [
  "Starboy",
  "Blinding Lights",
  "Daft Punk",
  "Coldplay",
  "Synthwave Chill",
  "Lofi Study Beats",
  "Night Drive Hits",
];

export default function SearchModal() {
  const {
    isSearchOpen,
    closeSearch,
    playTrack,
    searchHistory,
    addSearchHistory,
    removeSearchHistoryItem,
    clearSearchHistory,
  } = usePlayerStore();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [isSearchOpen]);

  // Escape closes
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && isSearchOpen) closeSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSearchOpen, closeSearch]);

  const doSearch = useCallback(
    async (q) => {
      const cleanQ = q.trim();
      if (!cleanQ) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      addSearchHistory(cleanQ);

      try {
        const tracks = await searchTracks(cleanQ, 20);
        setResults(Array.isArray(tracks) ? tracks : []);
      } catch (err) {
        setError(err.message || "Search failed. Is the backend running?");
      } finally {
        setLoading(false);
      }
    },
    [addSearchHistory]
  );

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  const handleSelect = (track) => {
    if (query) addSearchHistory(query);
    playTrack(track);
    closeSearch();
  };

  const handleHistoryClick = (item) => {
    setQuery(item);
    doSearch(item);
    inputRef.current?.focus();
  };

  if (!isSearchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onClick={closeSearch}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl glass-strong rounded-2xl overflow-hidden shadow-2xl animate-slide-up border border-white/10"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search tracks"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06] bg-white/[0.02]">
          {loading ? (
            <Loader2 className="w-5 h-5 text-accent shrink-0 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-white/40 shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            placeholder="Search songs, artists, albums…"
            className="flex-1 bg-transparent text-white placeholder-white/30 text-base outline-none font-medium"
            spellCheck={false}
            autoComplete="off"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
              className="text-white/30 hover:text-white transition-colors text-xs px-2 py-1 rounded bg-white/5"
            >
              Clear
            </button>
          )}
          <div className="flex items-center gap-2">
            <kbd className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded border border-white/10">ESC</kbd>
            <button onClick={closeSearch} className="text-white/40 hover:text-white transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results / History Container */}
        <div
          className="max-h-[62vh] overflow-y-auto py-3 px-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
        >
          {error && (
            <div className="text-center py-8 text-red-400/80 text-sm bg-red-500/10 rounded-xl m-2 border border-red-500/20">
              {error}
            </div>
          )}

          {!loading && !error && query && results.length === 0 && (
            <div className="text-center py-12 text-white/30">
              <Music className="w-9 h-9 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No results found for "{query}"</p>
              <p className="text-xs text-white/20 mt-1">Check spelling or search for another artist</p>
            </div>
          )}

          {/* Empty Query State — Show Recent Searches and Quick Trending */}
          {!query && (
            <div className="flex flex-col gap-6 py-2 px-2">
              {/* ── Recent Searches ── */}
              {searchHistory && searchHistory.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2 mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-white/60 tracking-wide uppercase">
                      <History className="w-3.5 h-3.5 text-accent" />
                      <span>Recent Searches</span>
                    </div>
                    <button
                      onClick={clearSearchHistory}
                      className="text-[11px] text-white/30 hover:text-red-400 flex items-center gap-1 transition-colors"
                      title="Clear all recent searches"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="group flex items-center gap-1.5 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] hover:border-white/20 text-white/80 hover:text-white px-3 py-1.5 rounded-full text-xs transition-all duration-150 cursor-pointer"
                        onClick={() => handleHistoryClick(item)}
                      >
                        <History className="w-3 h-3 text-white/30 group-hover:text-accent transition-colors" />
                        <span className="font-medium truncate max-w-[180px]">{item}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSearchHistoryItem(item);
                          }}
                          className="ml-1 text-white/20 hover:text-white/80 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                          title="Remove from history"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Trending / Quick Suggestions ── */}
              <div>
                <div className="flex items-center gap-1.5 px-2 mb-3 text-xs font-semibold text-white/60 tracking-wide uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span>Trending Searches</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TRENDING.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleHistoryClick(item)}
                      className="flex items-center gap-1 bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.06] hover:border-accent/40 text-white/70 hover:text-accent px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 group"
                    >
                      <span>{item}</span>
                      <ArrowUpRight className="w-3 h-3 text-white/20 group-hover:text-accent transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Active Search Results */}
          {results.map((track) => (
            <TrackCard key={track.id} track={track} onSelect={handleSelect} />
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-white/30 bg-white/[0.01]">
          <div className="flex items-center gap-4">
            <span><kbd className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/40">↵</kbd> Play</span>
            <span><kbd className="font-mono bg-white/5 px-1.5 py-0.5 rounded text-white/40">+Q</kbd> Add to queue</span>
          </div>
          <span>Powered by YouTube Music</span>
        </div>
      </div>
    </div>
  );
}
