/**
 * BrowseView — YT Music-style home screen.
 *
 * Layout:
 *   BrowseTopBar
 *   ───────────────────────
 *   Greeting
 *   [Mood filter pills] (Relax, Energize, Workout, etc.)
 *   NowPlayingBanner (if active)
 *   Recently Played row (if any)
 *   [Song rows] × N
 */
import { useEffect, useReducer, useState } from "react";
import { searchTracks } from "../lib/api";
import usePlayerStore from "../store/usePlayerStore";
import BrowseTopBar from "./BrowseTopBar";
import NowPlayingBanner from "./NowPlayingBanner";
import TrackRow from "./TrackRow";

// ─── Filter Pills ────────────────────────────────────────────────
const FILTER_PILLS = [
  { id: "all",      label: "All" },
  { id: "relax",    label: "Relax" },
  { id: "energize", label: "Energize" },
  { id: "workout",  label: "Workout" },
  { id: "focus",    label: "Focus" },
  { id: "sad",      label: "Sad" },
  { id: "party",    label: "Party" },
  { id: "romance",  label: "Romance" },
];

// ─── Static Fallback Data ────────────────────────────────────────
// If the backend is off, we show these so the UI still looks great.
const FALLBACK_TRACKS = [
  { id: "jfKfPfyJRk", title: "Lofi Study", artist: "ChillHop Music", thumbnail: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&h=300&fit=crop", duration: 180 },
  { id: "7NOSDKb0Hl", title: "Midnight Drive", artist: "Synthwave Boy", thumbnail: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=300&h=300&fit=crop", duration: 210 },
  { id: "3jWRrafhO7", title: "Coffee Shop Beats", artist: "Rainy Vibes", thumbnail: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?w=300&h=300&fit=crop", duration: 195 },
  { id: "9fKfPfyJRk", title: "Cyberpunk City", artist: "Neon Nights", thumbnail: "https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?w=300&h=300&fit=crop", duration: 240 },
  { id: "1jWRrafhO7", title: "Sunset Chords", artist: "Acoustic Chill", thumbnail: "https://images.unsplash.com/photo-1493225457224-ca58739d48b1?w=300&h=300&fit=crop", duration: 185 },
];

// ─── Pre-fetched discovery rows ──────────────────────────────────
const DISCOVERY_ROWS = [
  { key: "mixed",     title: "Mixed for you",          query: "chill hits mix" },
  { key: "new",       title: "New releases",           query: "new hit songs 2024" },
  { key: "lofi",      title: "Lofi beats",             query: "lofi hip hop study beats" },
  { key: "throwback", title: "Forgotten favorites",    query: "throwback classics" },
];

const initialRowState = Object.fromEntries(
  DISCOVERY_ROWS.map(({ key }) => [key, { loading: true, tracks: [], error: false }])
);

function rowReducer(state, { key, type, tracks }) {
  switch (type) {
    case "success": return { ...state, [key]: { loading: false, tracks, error: false } };
    case "error":   return { ...state, [key]: { loading: false, tracks: [], error: true  } };
    default: return state;
  }
}

// ─── Component ───────────────────────────────────────────────────
export default function BrowseView() {
  const { history, currentTrack, favorites, playCounts } = usePlayerStore();
  const [rows, dispatch] = useReducer(rowReducer, initialRowState);
  const [activeFilter, setActiveFilter] = useState("all");

  // Derive most played tracks sorted by playCount descending
  const mostPlayedTracks = Object.values(playCounts || {})
    .filter((item) => item?.count >= 1 && item?.track)
    .sort((a, b) => b.count - a.count)
    .map((item) => ({
      ...item.track,
      playCount: item.count,
    }))
    .slice(0, 15);

  useEffect(() => {
    // When filter changes, we could re-fetch. For now, fetch default rows on mount.
    DISCOVERY_ROWS.forEach(({ key, query }) => {
      // Set loading
      dispatch({ key, type: "loading" });
      
      const searchQuery = activeFilter === "all" ? query : `${activeFilter} ${query}`;
      
      searchTracks(searchQuery, 15)
        .then((tracks) => {
          // If the backend returns empty or weird results, use fallback
          if (!tracks || tracks.length === 0) {
            dispatch({ key, type: "success", tracks: [...FALLBACK_TRACKS].sort(() => 0.5 - Math.random()) });
          } else {
            dispatch({ key, type: "success", tracks });
          }
        })
        .catch(() => {
          // If backend fails, use fallback so UI doesn't look empty
          dispatch({ key, type: "success", tracks: [...FALLBACK_TRACKS].sort(() => 0.5 - Math.random()) });
        });
    });
  }, [activeFilter]);

  const hour = new Date().getHours();
  const greeting =
    hour < 5  ? "Still up?" :
    hour < 12 ? "Good morning" :
    hour < 17 ? "Good afternoon" :
    hour < 21 ? "Good evening" :
                "Night owl";

  return (
    <div className="relative flex flex-col h-screen overflow-hidden bg-obsidian">
      {/* Subtle background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: "radial-gradient(circle at 50% 0%, rgba(40,40,60,0.15) 0%, transparent 60%)",
        }}
      />

      <BrowseTopBar />

      <div
        className="relative z-10 flex-1 overflow-y-auto"
        style={{ paddingTop: "72px", paddingBottom: "130px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
      >
        {/* ── Greeting ──────────────────────────────────────────── */}
        <div className="px-5 sm:px-8 pt-2 pb-3">
          <h1 className="text-[28px] sm:text-[34px] font-bold text-white/95 tracking-tight">
            {greeting}
          </h1>
        </div>

        {/* ── Filter Pills (YT Music style) ────────────────────── */}
        <div className="px-5 sm:px-8 mb-8 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <div className="flex items-center gap-2.5 pb-2">
            {FILTER_PILLS.map((pill) => {
              const isActive = activeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setActiveFilter(pill.id)}
                  className={`
                    px-4 py-1.5 rounded-lg whitespace-nowrap text-sm font-medium transition-colors
                    ${isActive 
                      ? "bg-white text-black" 
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                    }
                  `}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Now Playing banner ────────────────────────────────── */}
        {currentTrack && (
          <div className="mb-8">
            <NowPlayingBanner />
          </div>
        )}

        {/* ── On Repeat (Most Played) ─────────────────────────── */}
        {mostPlayedTracks.length > 0 && activeFilter === "all" && (
          <div className="mb-10">
            <TrackRow
              title="On Repeat (Most Played)"
              emoji="🔁"
              tracks={mostPlayedTracks}
              loading={false}
            />
          </div>
        )}

        {/* ── Recently Played ──────────────────────────────────── */}
        {history.length > 0 && activeFilter === "all" && (
          <div className="mb-10">
            <TrackRow
              title="Recently Played"
              emoji="🕒"
              tracks={history.slice(0, 15)}
              loading={false}
            />
          </div>
        )}

        {/* ── Favorites ────────────────────────────────────────── */}
        {favorites && favorites.length > 0 && activeFilter === "all" && (
          <div className="mb-10">
            <TrackRow
              title="Your Favorites"
              emoji="❤️"
              tracks={favorites}
              loading={false}
            />
          </div>
        )}

        {/* ── Song Rows ────────────────────────────────────────── */}
        <div className="flex flex-col gap-10">
          {DISCOVERY_ROWS.map(({ key, title }) => {
            const { loading, tracks, error } = rows[key];
            return (
              <TrackRow
                key={key}
                title={title}
                tracks={tracks}
                loading={loading}
                error={error}
              />
            );
          })}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
