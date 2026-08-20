/**
 * SearchModal — Ctrl+K / "/" overlay with live search and results.
 * Debounced 350ms, shows up to 20 results with thumbnails.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, Music } from "lucide-react";
import usePlayerStore from "../store/usePlayerStore";
import { searchTracks } from "../lib/api";
import TrackCard from "./TrackCard";

export default function SearchModal() {
  const { isSearchOpen, closeSearch, playTrack } = usePlayerStore();
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

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const tracks = await searchTracks(q, 20);
      setResults(Array.isArray(tracks) ? tracks : []);
    } catch (err) {
      setError(err.message || "Search failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  const handleSelect = (track) => {
    playTrack(track);
    closeSearch();
  };

  if (!isSearchOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
      onClick={closeSearch}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl glass-strong rounded-2xl overflow-hidden shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search tracks"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
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
            className="flex-1 bg-transparent text-white placeholder-white/25 text-base outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="flex items-center gap-2">
            <kbd className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">ESC</kbd>
            <button onClick={closeSearch} className="text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto py-2 px-2">
          {error && (
            <div className="text-center py-8 text-red-400/70 text-sm">{error}</div>
          )}

          {!loading && !error && query && results.length === 0 && (
            <div className="text-center py-10 text-white/25">
              <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No results for "{query}"</p>
            </div>
          )}

          {!query && (
            <div className="text-center py-10 text-white/20">
              <Search className="w-7 h-7 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Type to search millions of tracks</p>
              <p className="text-xs mt-1 text-white/10">Powered by YouTube Music</p>
            </div>
          )}

          {results.map((track) => (
            <TrackCard key={track.id} track={track} onSelect={handleSelect} />
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-2.5 border-t border-white/[0.04] flex items-center gap-4 text-[10px] text-white/20">
          <span><kbd className="font-mono">↵</kbd> to play</span>
          <span><kbd className="font-mono">+Q</kbd> queue</span>
          <span><kbd className="font-mono">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
