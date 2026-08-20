import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchLyrics, fetchSuggestions } from "../lib/api";

const REPEAT_MODES = ["none", "all", "one"];

const usePlayerStore = create(
  persist(
    (set, get) => ({
      // ── Track state ──────────────────────────────────────────────
      currentTrack: null,
      queue: [],
      history: [],
      favorites: [],
      searchHistory: [],
      playCounts: {}, // { [trackId]: { count: number, track: Track, lastPlayed: number } }

      // ── Autoplay state ───────────────────────────────────────────
      isAutoplay: true,
      autoplayQueue: [],
      autoplayLoading: false,

      // ── Playback state ───────────────────────────────────────────
      isPlaying: false,
      isLoading: false,
      streamUrl: null,
      progress: 0,      // seconds
      duration: 0,      // seconds
      volume: 0.8,
      isMuted: false,

      // ── Modes ────────────────────────────────────────────────────
      isShuffle: false,
      repeatMode: "none", // "none" | "all" | "one"

      // ── UI panels ────────────────────────────────────────────────
      isSearchOpen: false,
      isQueueOpen: false,
      isLyricsOpen: false,

      // ── Scene ────────────────────────────────────────────────────
      activeScene: "song-aurora",

      // ── View mode ────────────────────────────────────────────────
      isCinematic: false,
      isPocketMode: false,

      // ── Ambient audio ─────────────────────────────────────────────
      ambientLevels: { rain: 0, vinyl: 0, engine: 0 },

      // ── Lyrics ───────────────────────────────────────────────────
      lyrics: null,       // { synced, lines } | { synced: false, plain }
      lyricsLoading: false,

      // ── Actions ──────────────────────────────────────────────────
      openSearch: () => set({ isSearchOpen: true }),
      closeSearch: () => set({ isSearchOpen: false }),
      toggleQueue: () => set((s) => ({ isQueueOpen: !s.isQueueOpen, isLyricsOpen: false })),
      setScene: (scene) => set({ activeScene: scene }),
      setAmbientLevel: (key, val) =>
        set((s) => ({ ambientLevels: { ...s.ambientLevels, [key]: val } })),
      toggleLyrics: () => set((s) => ({ isLyricsOpen: !s.isLyricsOpen, isQueueOpen: false })),
      toggleCinematic: () => set((s) => ({ isCinematic: !s.isCinematic })),
      togglePocketMode: () => set((s) => ({ isPocketMode: !s.isPocketMode })),

      // Search history actions
      addSearchHistory: (query) => {
        const q = (query || "").trim();
        if (!q) return;
        set((s) => ({
          searchHistory: [q, ...(s.searchHistory || []).filter((item) => item.toLowerCase() !== q.toLowerCase())].slice(0, 20),
        }));
      },
      removeSearchHistoryItem: (query) => {
        set((s) => ({
          searchHistory: (s.searchHistory || []).filter((item) => item.toLowerCase() !== (query || "").toLowerCase()),
        }));
      },
      clearSearchHistory: () => set({ searchHistory: [] }),

      setProgress: (p) => set({ progress: p }),
      setDuration: (d) => set({ duration: d }),
      setVolume: (v) => set({ volume: v, isMuted: v === 0 }),
      toggleMute: () =>
        set((s) => ({ isMuted: !s.isMuted })),

      toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
      toggleAutoplay: () => {
        const nextVal = !get().isAutoplay;
        set({ isAutoplay: nextVal });
        if (nextVal && get().currentTrack && get().autoplayQueue.length <= 3) {
          get()._loadSuggestions(get().currentTrack);
        }
      },
      cycleRepeat: () =>
        set((s) => ({
          repeatMode: REPEAT_MODES[(REPEAT_MODES.indexOf(s.repeatMode) + 1) % 3],
        })),

      setIsPlaying: (v) => set({ isPlaying: v }),

      // Play a track — instantly updates playback state and signals audio engine via streamUrl
      playTrack: (track, addToHistory = true) => {
        if (!track || !track.id) return;
        const { currentTrack, playCounts } = get();

        // Push previous track to history if different and addToHistory is true
        if (addToHistory && currentTrack && currentTrack.id !== track.id) {
          set((s) => ({
            history: [s.currentTrack, ...s.history.filter((t) => t.id !== s.currentTrack.id)].slice(0, 50),
          }));
        }

        // Increment play count for On Repeat / Most Played
        const existing = playCounts?.[track.id];
        const newCount = (existing?.count || 0) + 1;
        const updatedTrack = { ...track, playCount: newCount };

        set((s) => ({
          playCounts: {
            ...(s.playCounts || {}),
            [track.id]: {
              count: newCount,
              track: updatedTrack,
              lastPlayed: Date.now(),
            },
          },
        }));

        // Remove track from upcoming queues since it is now the active playing track
        set((s) => ({
          queue: s.queue.filter((t) => t.id !== track.id),
          autoplayQueue: s.autoplayQueue.filter((t) => t.id !== track.id),
        }));

        // Instant synchronous state update — 0ms delay, status bar & player active immediately
        set({
          currentTrack: track,
          streamUrl: track.id,
          playTimestamp: Date.now(),
          isPlaying: true,
          isLoading: false,
          progress: 0,
          duration: track.duration || 0,
          lyrics: null,
        });

        // Background non-blocking tasks
        get()._loadLyrics(track);

        if (get().isAutoplay) {
          get()._loadSuggestions(track);
        }
      },

      _loadLyrics: async (track) => {
        set({ lyricsLoading: true, lyrics: null });
        try {
          const data = await fetchLyrics(
            track.title,
            track.artist,
            track.duration || 0,
            track.id || ""
          );
          set({ lyrics: data, lyricsLoading: false });
        } catch {
          set({ lyricsLoading: false });
        }
      },

      _loadSuggestions: async (track) => {
        if (!track?.id) return;
        set({ autoplayLoading: true });
        try {
          const suggestions = await fetchSuggestions(track.id, 20);
          const { history, queue, currentTrack, autoplayQueue } = get();
          const existingIds = new Set([
            track.id,
            ...(currentTrack ? [currentTrack.id] : []),
            ...history.map((t) => t.id),
            ...queue.map((t) => t.id),
            ...autoplayQueue.map((t) => t.id),
          ]);
          const newUnique = (suggestions || []).filter((s) => !existingIds.has(s.id));
          set((s) => {
            const merged = [...s.autoplayQueue, ...newUnique];
            return {
              autoplayQueue: merged.length > 0 ? merged : (suggestions || []),
              autoplayLoading: false,
            };
          });
        } catch (err) {
          console.warn("Failed to load autoplay suggestions:", err);
          set({ autoplayLoading: false });
        }
      },

      // Queue management
      addToQueue: (track) =>
        set((s) => ({
          queue: [...s.queue.filter((t) => t.id !== track.id), track],
          autoplayQueue: s.autoplayQueue.filter((t) => t.id !== track.id),
        })),

      removeFromQueue: (id) =>
        set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),

      reorderQueue: (newQueue) => set({ queue: newQueue }),

      clearQueue: () => set({ queue: [] }),

      toggleFavorite: (track) => set((s) => {
        const exists = s.favorites.some((t) => t.id === track.id);
        if (exists) {
          return { favorites: s.favorites.filter((t) => t.id !== track.id) };
        }
        return { favorites: [track, ...s.favorites] };
      }),

      next: async () => {
        const { queue, currentTrack, isShuffle, repeatMode, history, isAutoplay, autoplayQueue } = get();

        if (repeatMode === "one") {
          set({ progress: 0, isPlaying: true });
          return "restart";
        }

        // 1. Priority: Manual user queue
        if (queue.length > 0) {
          let idx = isShuffle ? Math.floor(Math.random() * queue.length) : 0;
          const nextTrack = queue[idx];
          set((s) => ({
            queue: s.queue.filter((_, i) => i !== idx),
          }));
          get().playTrack(nextTrack);
          return;
        }

        // 2. Repeat all mode
        if (repeatMode === "all" && history.length > 0) {
          const track = history[history.length - 1];
          get().playTrack(track);
          return;
        }

        // 3. Infinite Autoplay & Smart Recommendations
        if (isAutoplay && currentTrack) {
          if (autoplayQueue.length > 0) {
            const nextTrack = autoplayQueue[0];
            set((s) => ({
              autoplayQueue: s.autoplayQueue.slice(1),
            }));
            get().playTrack(nextTrack);
            // If autoplay buffer is low, refill in background
            if (get().autoplayQueue.length <= 3) {
              get()._loadSuggestions(nextTrack);
            }
            return;
          }

          // In case autoplayQueue is depleted, fetch suggestions immediately
          try {
            set({ autoplayLoading: true });
            const suggestions = await fetchSuggestions(currentTrack.id, 20);
            const playedIds = new Set([
              currentTrack.id,
              ...history.map((t) => t.id),
            ]);
            const filtered = suggestions.filter((s) => !playedIds.has(s.id));
            const candidates = filtered.length > 0 ? filtered : suggestions;
            if (candidates.length > 0) {
              const nextTrack = candidates[0];
              set({ autoplayQueue: candidates.slice(1), autoplayLoading: false });
              get().playTrack(nextTrack);
              return;
            }
          } catch (e) {
            console.error("Autoplay next fetch failed:", e);
            set({ autoplayLoading: false });
          }
        }

        // 4. Autoplay disabled or no suggestions
        set({ isPlaying: false, isLoading: false });
      },

      previous: () => {
        const { history } = get();
        if (!history || history.length === 0) {
          // If no history, restart track from 0:00
          set({ progress: 0 });
          return "restart";
        }
        const prevTrack = history[0];
        set((s) => ({ history: s.history.slice(1) }));
        get().playTrack(prevTrack, false);
        return "played-prev";
      },
    }),
    {
      name: "nightwave-storage",
      partialize: (state) => ({
        history: state.history,
        favorites: state.favorites,
        isAutoplay: state.isAutoplay,
        searchHistory: state.searchHistory,
        playCounts: state.playCounts,
      }),
    }
  )
);

export default usePlayerStore;

