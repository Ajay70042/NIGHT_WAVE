import { create } from "zustand";
import { resolveStream, fetchLyrics } from "../lib/api";

const REPEAT_MODES = ["none", "all", "one"];

const usePlayerStore = create((set, get) => ({
  // ── Track state ──────────────────────────────────────────────
  currentTrack: null,
  queue: [],
  history: [],

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

  // ── Lyrics ───────────────────────────────────────────────────
  lyrics: null,       // { synced, lines } | { synced: false, plain }
  lyricsLoading: false,

  // ── Actions ──────────────────────────────────────────────────
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false }),
  toggleQueue: () => set((s) => ({ isQueueOpen: !s.isQueueOpen, isLyricsOpen: false })),
  toggleLyrics: () => set((s) => ({ isLyricsOpen: !s.isLyricsOpen, isQueueOpen: false })),

  setProgress: (p) => set({ progress: p }),
  setDuration: (d) => set({ duration: d }),
  setVolume: (v) => set({ volume: v, isMuted: v === 0 }),
  toggleMute: () =>
    set((s) => ({ isMuted: !s.isMuted })),

  toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeatMode: REPEAT_MODES[(REPEAT_MODES.indexOf(s.repeatMode) + 1) % 3],
    })),

  setIsPlaying: (v) => set({ isPlaying: v }),

  // Play a track — resolves stream URL then signals audio engine via streamUrl
  playTrack: async (track, insertAtFront = false) => {
    const { queue, currentTrack, history } = get();

    if (currentTrack && currentTrack.id !== track.id) {
      set((s) => ({ history: [s.currentTrack, ...s.history].slice(0, 50) }));
    }

    // Add to queue if not already there
    if (insertAtFront) {
      set((s) => ({
        queue: [track, ...s.queue.filter((t) => t.id !== track.id)],
      }));
    }

    set({ currentTrack: track, isLoading: true, streamUrl: null, progress: 0, lyrics: null });

    try {
      const data = await resolveStream(track.id);
      // Store videoId as streamUrl — IFrame API needs the video ID, not a URL
      // (Direct URLs fail: ANDROID_VR client URLs are rejected by browsers)
      set({ streamUrl: track.id, duration: data.duration, isLoading: false });
    } catch (err) {
      console.error("Stream resolution failed:", err);
      // Fall back to using the track ID directly — IFrame API can always play by ID
      set({ streamUrl: track.id, isLoading: false });
    }

    // Fetch lyrics in background
    get()._loadLyrics(track);
  },

  _loadLyrics: async (track) => {
    set({ lyricsLoading: true, lyrics: null });
    try {
      const data = await fetchLyrics(track.title, track.artist, track.duration || 0);
      set({ lyrics: data, lyricsLoading: false });
    } catch {
      set({ lyricsLoading: false });
    }
  },

  // Queue management
  addToQueue: (track) =>
    set((s) => ({ queue: [...s.queue.filter((t) => t.id !== track.id), track] })),

  removeFromQueue: (id) =>
    set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),

  reorderQueue: (newQueue) => set({ queue: newQueue }),

  clearQueue: () => set({ queue: [] }),

  next: () => {
    const { queue, currentTrack, isShuffle, repeatMode, history } = get();
    if (repeatMode === "one") {
      // Restart — signal via re-setting streamUrl trick (handled in audio engine)
      set((s) => ({ progress: 0 }));
      return "restart";
    }
    if (queue.length === 0) {
      if (repeatMode === "all" && history.length > 0) {
        const track = history[history.length - 1];
        get().playTrack(track);
        return;
      }
      set({ isPlaying: false });
      return;
    }
    let idx = isShuffle ? Math.floor(Math.random() * queue.length) : 0;
    const nextTrack = queue[idx];
    set((s) => ({
      queue: s.queue.filter((_, i) => i !== idx),
    }));
    get().playTrack(nextTrack);
  },

  previous: () => {
    const { history, progress } = get();
    if (progress > 3) {
      set({ progress: 0 });
      return "seek-start";
    }
    if (history.length === 0) return;
    const prev = history[0];
    set((s) => ({ history: s.history.slice(1) }));
    get().playTrack(prev);
  },
}));

export default usePlayerStore;
