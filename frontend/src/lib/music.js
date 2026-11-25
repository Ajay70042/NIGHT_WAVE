import { create } from "zustand";
import c1 from "../assets/sonara/cover-1.jpg";
import c2 from "../assets/sonara/cover-2.jpg";
import c3 from "../assets/sonara/cover-3.jpg";
import c4 from "../assets/sonara/cover-4.jpg";
import c5 from "../assets/sonara/cover-5.jpg";
import c6 from "../assets/sonara/cover-6.jpg";
import {
  resolveStream,
  getAudioStreamUrl,
  checkUserStatus,
  fetchUserHome,
  fetchUserLiked,
  fetchUserPlaylists,
  fetchPlaylistTracks,
  fetchUserHistory,
  fetchCharts,
  fetchLyrics,
  fetchSuggestions,
  disconnectUserAccount,
  prefetchStream,
  waitForBackend,
  likeSongOnYTM,
  recordPlayHistory,
  createYTMPlaylist,
  addTracksToYTMPlaylist,
} from "./api";
import { ensureBeatAnalyser } from "./audio";

export const fallbackCovers = [c1, c2, c3, c4, c5, c6];

/**
 * Upscale low-res YouTube/Google thumbnails to crisp 800x800 or 1080p maxresdefault
 */
export function getHighResArt(url) {
  if (!url) return c1;
  let s = String(url);
  if (/=w\d+-h\d+/i.test(s)) {
    return s.replace(/=w\d+-h\d+[^?]*/i, "=w800-h800-l90-rj");
  }
  if (/=s\d+/i.test(s)) {
    return s.replace(/=s\d+[^?]*/i, "=s800-c");
  }
  if (s.includes("/hqdefault.jpg")) {
    return s.replace(/\/hqdefault\.jpg.*/i, "/maxresdefault.jpg");
  }
  return s;
}

// Helpers for localStorage persistence
function getStorage(key, fallback) {
  try {
    const val = localStorage.getItem(`sonara:${key}`);
    return val ? JSON.parse(val) : fallback;
  } catch (_) {
    return fallback;
  }
}

function setStorage(key, value) {
  try {
    localStorage.setItem(`sonara:${key}`, JSON.stringify(value));
  } catch (_) { }
}

const DEFAULT_AVATAR = "";

// Initial cached states
const initialCachedProfile = getStorage("user_profile", {
  name: "",
  handle: "",
  email: "",
  avatar: DEFAULT_AVATAR,
  connected: false,
});

const initialCachedLiked = getStorage("liked_tracks", []);
const initialCachedPlaylists = getStorage("user_playlists", []);
const initialCachedHistory = getStorage("history_tracks", []);

export const albums = [];
export const tracks = [];
export const playlists = [];

// Global dynamic registries
export const tracksMap = new Map();
export const albumsMap = new Map();
export const playlistsMap = new Map();

export function registerTrack(rawT) {
  if (!rawT || !rawT.id) return null;
  const id = String(rawT.id);
  const title = rawT.title || "Unknown Track";
  const artist = rawT.artist || "Unknown Artist";
  const duration = Number(rawT.duration) || 200;
  const cover = getHighResArt(rawT.thumbnail || rawT.cover || c1);
  const albumTitle = rawT.album || rawT.albumTitle || title;
  const albumId = `alb_${id}`;

  if (!albumsMap.has(albumId)) {
    albumsMap.set(albumId, {
      id: albumId,
      title: albumTitle,
      kr: "",
      artist,
      year: new Date().getFullYear(),
      cover,
      hue: Math.floor(Math.random() * 80) + 240,
    });
  }

  const normalized = {
    id,
    title,
    artist,
    albumId,
    duration,
    cover,
    added: Date.now() / 1000,
    raw: rawT,
  };

  tracksMap.set(id, normalized);
  return normalized;
}

export function registerTracks(rawList) {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(registerTrack).filter(Boolean);
}

export function registerPlaylist(rawP) {
  if (!rawP || !rawP.id) return null;
  const id = String(rawP.id);
  const name = rawP.title || rawP.name || "Untitled Playlist";
  const cover = getHighResArt(rawP.thumbnail || rawP.cover || c1);
  const trackIds = Array.isArray(rawP.tracks) ? rawP.tracks.map((t) => registerTrack(t).id) : [];

  const pl = {
    id,
    name,
    cover,
    ids: trackIds,
    count: rawP.itemCount || rawP.count || trackIds.length || 0,
    raw: rawP,
  };
  playlistsMap.set(id, pl);
  return pl;
}

// Pre-register cached items on startup
if (initialCachedLiked.length > 0) registerTracks(initialCachedLiked);
if (initialCachedHistory.length > 0) registerTracks(initialCachedHistory);
if (initialCachedPlaylists.length > 0) initialCachedPlaylists.forEach(registerPlaylist);

export const albumOf = (t) => {
  if (!t) {
    return {
      id: "none",
      title: "Murgichor",
      kr: "",
      artist: "Murgichor",
      year: new Date().getFullYear(),
      cover: c1,
      hue: 280,
    };
  }
  if (t.albumId && albumsMap.has(t.albumId)) {
    const alb = albumsMap.get(t.albumId);
    return { ...alb, cover: getHighResArt(alb.cover) };
  }
  const synthetic = {
    id: `syn_${t.id}`,
    title: t.album || t.title || "Album",
    kr: "",
    artist: t.artist || "Artist",
    year: new Date().getFullYear(),
    cover: getHighResArt(t.cover || t.thumbnail || c1),
    hue: 280,
  };
  albumsMap.set(synthetic.id, synthetic);
  return synthetic;
};

export const trackById = (id) => {
  if (!id) return null;
  return tracksMap.get(id) || null;
};

export const fmt = (s) => {
  if (isNaN(s) || s < 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

export const defaultLyricLines = [
  "Under the lavender sky", "we leave the city lights behind", "your voice, a quiet tide",
  "folding the night in two", "every street remembers you", "drifting through the quiet night",
  "Hold the silence like a song", "the river carries us along", "softly, softly, we belong",
  "and the morning waits for us", "colors bleeding into dust", "I keep falling into trust",
  "Under the lavender sky", "we were never meant to hide",
];

// Determine starting track from history/liked or fallback
const startingTrack = initialCachedHistory[0] || initialCachedLiked[0] || null;

// ─── Real Audio Engine Instance ──────────────────────────────────────────────
let globalAudio = null;
if (typeof window !== "undefined") {
  globalAudio = new Audio();
  globalAudio.crossOrigin = "anonymous";
  globalAudio.preload = "auto";
}

export const usePlayer = create((set, get) => ({
  currentId: startingTrack ? startingTrack.id : null,
  playing: false,
  time: 0,
  exactTime: 0,
  duration: startingTrack?.duration || 0,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: "off",
  queue: [],
  playedIds: [],
  queueOpen: false,
  favs: initialCachedLiked.map((t) => t.id),
  sidebarOpen: true,

  // Real backend state pre-loaded from cache
  userProfile: initialCachedProfile,
  likedTracks: initialCachedLiked,
  userPlaylists: initialCachedPlaylists,
  historyTracks: initialCachedHistory,
  trendingTracks: [],
  homeShelves: [],
  activePlaylistId: null,
  activePlaylistTracks: [],
  currentLyrics: null,
  isAutoplay: true,

  play: async (id, explicitQueue = null) => {
    const s = get();
    const targetId = id || s.currentId;
    if (!targetId) return;
    const targetTrack = trackById(targetId);
    if (!targetTrack) {
      console.warn("Track not found in registry:", targetId);
      return;
    }

    const nextPlayed = [targetId, ...s.playedIds.filter((p) => p !== targetId)].slice(0, 50);

    // If explicit queue is provided (from playlist, "Play All", or advancing queue)
    if (explicitQueue && Array.isArray(explicitQueue)) {
      set({
        currentId: targetId,
        time: 0,
        exactTime: 0,
        duration: targetTrack.duration || 200,
        playing: true,
        queue: explicitQueue.filter((qId) => qId !== targetId),
        playedIds: nextPlayed,
        currentLyrics: null,
      });
    } else if (id && id !== s.currentId) {
      // Single song played from Home, Search, or Library:
      // Generate fresh YouTube Music radio queue tailored to this song
      const remainingQueue = s.queue.includes(id)
        ? s.queue.slice(s.queue.indexOf(id) + 1)
        : [];

      set({
        currentId: id,
        time: 0,
        exactTime: 0,
        duration: targetTrack.duration || 200,
        playing: true,
        queue: remainingQueue,
        playedIds: nextPlayed,
        currentLyrics: null,
      });
    } else {
      set({ playing: true });
    }

    // Real audio stream setup
    if (globalAudio) {
      try {
        let streamSrc = "";
        if (!String(targetId).startsWith("t") || targetTrack.raw) {
          streamSrc = getAudioStreamUrl(targetTrack.id);
        }

        if (streamSrc) {
          if (globalAudio.src !== streamSrc) {
            globalAudio.src = streamSrc;
            globalAudio.load();
          }
          globalAudio.volume = s.muted ? 0 : s.volume;
          await globalAudio.play().catch(() => { });
        } else {
          globalAudio.pause();
        }
      } catch (err) {
        console.error("Audio playback error:", err);
      }
    }

    // Sync play to YouTube Music history if connected
    if (targetTrack && !String(targetTrack.id).startsWith("t") && get().userProfile?.connected) {
      recordPlayHistory(targetTrack.id);
      set((state) => {
        const filtered = state.historyTracks.filter((h) => h.id !== targetTrack.id);
        const updated = [targetTrack, ...filtered].slice(0, 100);
        setStorage("history_tracks", updated);
        return { historyTracks: updated };
      });
    }

    // ── YouTube Music Radio / Suggestions Queue ─────────────────────────────
    // If starting a single song, replace queue with fresh YT Music radio;
    // if advancing through a queue and running low (< 5), append more related songs.
    if (targetTrack && !String(targetTrack.id).startsWith("t")) {
      const curQ = get().queue;
      if (!explicitQueue) {
        get().loadRelatedMusic(targetTrack.id, true);
      } else if (curQ.length < 5) {
        get().loadRelatedMusic(targetTrack.id, false);
      }
    }

    // Fetch synchronized lyrics in background
    if (targetTrack) {
      fetchLyrics(targetTrack.title, targetTrack.artist, targetTrack.duration, targetTrack.id)
        .then((data) => {
          if (data && data.lines && data.lines.length > 0) {
            set({ currentLyrics: { synced: Boolean(data.synced), lines: data.lines } });
          } else {
            set({ currentLyrics: null });
          }
        })
        .catch(() => set({ currentLyrics: null }));

      // MediaSession update
      if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
        const a = albumOf(targetTrack);
        navigator.mediaSession.metadata = new MediaMetadata({
          title: targetTrack.title,
          artist: targetTrack.artist,
          album: a.title,
          artwork: [{ src: getHighResArt(a.cover), sizes: "512x512", type: "image/jpeg" }],
        });
      }
    }
  },

  loadRelatedMusic: async (videoId, replaceQueue = false) => {
    if (!videoId || String(videoId).startsWith("t")) return;
    try {
      const suggestions = await fetchSuggestions(videoId, 25);
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        const reg = registerTracks(suggestions);
        const state = get();
        const playedSet = new Set(state.playedIds);
        const allIds = reg.map((t) => t.id).filter((id) => id !== state.currentId);
        // Prefer tracks not recently played to avoid repeating the same songs
        const unplayed = allIds.filter((id) => !playedSet.has(id));
        const sugIds = unplayed.length > 0 ? unplayed : allIds;

        set((s) => {
          if (replaceQueue || s.queue.length === 0) {
            return { queue: sugIds };
          } else {
            const existingSet = new Set(s.queue);
            const newItems = sugIds.filter((id) => !existingSet.has(id));
            return { queue: [...s.queue, ...newItems] };
          }
        });
      }
    } catch (err) {
      console.warn("Failed to load related recommendations:", err);
    }
  },

  playFromQueue: (id) => {
    const s = get();
    const idx = s.queue.indexOf(id);
    const remaining = idx >= 0 ? s.queue.slice(idx + 1) : s.queue.filter((q) => q !== id);
    get().play(id, remaining);
  },

  toggle: () => {
    const s = get();
    const nextPlaying = !s.playing;
    if (nextPlaying && globalAudio && !globalAudio.src && s.currentId) {
      get().play(s.currentId);
      return;
    }
    set({ playing: nextPlaying });
    if (globalAudio && globalAudio.src) {
      if (nextPlaying) {
        globalAudio.play().catch(() => { });
      } else {
        globalAudio.pause();
      }
    }
  },

  next: () => {
    const s = get();
    if (s.repeat === "one") {
      if (globalAudio) globalAudio.currentTime = 0;
      return set({ time: 0, exactTime: 0, playing: true });
    }
    let q = [...s.queue];

    if (!q.length) {
      // If queue is empty, pick unplayed tracks from registry
      const playedSet = new Set(s.playedIds);
      q = Array.from(tracksMap.keys()).filter((id) => id !== s.currentId && !playedSet.has(id));
      if (!q.length) q = Array.from(tracksMap.keys()).filter((id) => id !== s.currentId);
    }

    if (!q.length) return;

    const idx = s.shuffle ? Math.floor(Math.random() * q.length) : 0;
    const nextId = q[idx];
    q.splice(idx, 1);
    if (s.repeat === "all" && s.currentId) q.push(s.currentId);

    if (nextId) {
      get().play(nextId, q);
    }
  },

  prev: () => {
    const s = get();
    if (s.time > 3) {
      if (globalAudio) globalAudio.currentTime = 0;
      return set({ time: 0 });
    }
    const allIds = Array.from(tracksMap.keys());
    const i = allIds.indexOf(s.currentId);
    const pId = allIds[(i - 1 + allIds.length) % allIds.length] || s.currentId;
    set({ queue: [s.currentId, ...s.queue.filter((q) => q !== pId)] });
    get().play(pId);
  },

  seek: (t, resumeIfPaused = false) => {
    const target = Math.max(0, Number(t) || 0);
    set({ time: Math.floor(target), exactTime: target });
    if (globalAudio) {
      if (!isNaN(globalAudio.duration) && globalAudio.duration > 0) {
        globalAudio.currentTime = Math.min(target, globalAudio.duration);
      } else {
        globalAudio.currentTime = target;
      }
      if (resumeIfPaused && globalAudio.paused && globalAudio.src) {
        set({ playing: true });
        globalAudio.play().catch(() => { });
      }
    }
  },

  // tick is NO-OP when real audio is loaded to eliminate time jittering
  tick: () => {
    const s = get();
    if (!s.playing) return;
    // Only simulate if using dummy mock tracks with no real audio stream
    if (globalAudio && globalAudio.src && !globalAudio.paused) {
      return;
    }
    const curTrack = trackById(s.currentId);
    const dur = s.duration || curTrack?.duration || 200;
    if (s.time + 1 >= dur) {
      get().next();
    } else {
      set({ time: s.time + 1 });
    }
  },

  setVolume: (v) => {
    set({ volume: v, muted: false });
    if (globalAudio) globalAudio.volume = v;
  },

  toggleMute: () => {
    const s = get();
    const nextMuted = !s.muted;
    set({ muted: nextMuted });
    if (globalAudio) globalAudio.volume = nextMuted ? 0 : s.volume;
  },

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

  cycleRepeat: () =>
    set((s) => ({
      repeat: s.repeat === "off" ? "all" : s.repeat === "all" ? "one" : "off",
    })),

  setQueue: (q) => set({ queue: q }),
  removeFromQueue: (id) => set((s) => ({ queue: s.queue.filter((q) => q !== id) })),
  toggleQueue: () => set((s) => ({ queueOpen: !s.queueOpen })),

  toggleFav: (id) =>
    set((s) => {
      const wasLiked = s.favs.includes(id);
      const nextLiked = !wasLiked;
      const nextFavs = wasLiked ? s.favs.filter((f) => f !== id) : [...s.favs, id];
      setStorage("favs", nextFavs);

      let nextLikedTracks = s.likedTracks;
      if (nextLiked) {
        const t = trackById(id);
        if (t && !s.likedTracks.some((x) => x.id === id)) {
          nextLikedTracks = [t, ...s.likedTracks];
        }
      } else {
        nextLikedTracks = s.likedTracks.filter((x) => x.id !== id);
      }
      setStorage("liked_tracks", nextLikedTracks);

      if (s.userProfile?.connected && id && !String(id).startsWith("t")) {
        likeSongOnYTM(id, nextLiked);
      }

      return { favs: nextFavs, likedTracks: nextLikedTracks };
    }),

  createPlaylist: async (title, videoIds = []) => {
    const res = await createYTMPlaylist(title, "", videoIds);
    const pls = await fetchUserPlaylists();
    if (Array.isArray(pls)) {
      const regPls = pls.map(registerPlaylist).filter(Boolean);
      set({ userPlaylists: regPls });
      setStorage("user_playlists", regPls);
    }
    return res;
  },

  addToPlaylist: async (playlistId, videoIds = []) => {
    const res = await addTracksToYTMPlaylist(playlistId, videoIds);
    const pls = await fetchUserPlaylists();
    if (Array.isArray(pls)) {
      const regPls = pls.map(registerPlaylist).filter(Boolean);
      set({ userPlaylists: regPls });
      setStorage("user_playlists", regPls);
    }
    return res;
  },

  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarOpen;
      try {
        localStorage.setItem("sonara:sidebar", next ? "1" : "0");
      } catch { }
      return { sidebarOpen: next };
    }),

  playPlaylist: async (playlistId, shuffle = false) => {
    try {
      const data = await fetchPlaylistTracks(playlistId);
      if (data && Array.isArray(data.tracks) && data.tracks.length > 0) {
        const reg = registerTracks(data.tracks);
        let ids = reg.map((t) => t.id);
        if (shuffle) ids = ids.sort(() => Math.random() - 0.5);
        get().play(ids[0], ids.slice(1));
      }
    } catch (e) {
      console.error("Play playlist error:", e);
    }
  },

  // ─── Backend Synchronization & Data Hydration ──────────────────────────────
  syncWithBackend: async () => {
    try {
      // 0. Wait for backend to be online
      await waitForBackend(25, 250);

      // 1. User status & Profile
      const status = await checkUserStatus();
      if (status && status.connected) {
        const u = status.user || {};
        const profile = {
          name: u.name || "YouTube Music User",
          handle: u.handle || "",
          email: u.email || "",
          avatar: getHighResArt(u.photoUrl || u.avatar || DEFAULT_AVATAR),
          connected: true,
        };
        set({ userProfile: profile });
        setStorage("user_profile", profile);
      } else {
        const loggedOutProfile = {
          name: "",
          handle: "",
          email: "",
          avatar: DEFAULT_AVATAR,
          connected: false,
        };
        set({
          userProfile: loggedOutProfile,
          likedTracks: [],
          userPlaylists: [],
          historyTracks: [],
        });
        setStorage("user_profile", loggedOutProfile);
        setStorage("liked_tracks", []);
        setStorage("user_playlists", []);
        setStorage("history_tracks", []);
        return;
      }

      // 2. Liked Tracks
      const liked = await fetchUserLiked();
      let regLiked = [];
      if (Array.isArray(liked) && liked.length > 0) {
        regLiked = registerTracks(liked);
        const favIds = regLiked.map((t) => t.id);
        set({ likedTracks: regLiked, favs: favIds });
        setStorage("liked_tracks", regLiked);
      }

      // 3. User Playlists
      const pls = await fetchUserPlaylists();
      if (Array.isArray(pls) && pls.length > 0) {
        const regPls = pls.map(registerPlaylist).filter(Boolean);
        set({ userPlaylists: regPls });
        setStorage("user_playlists", regPls);
      }

      // 4. User History
      const hist = await fetchUserHistory();
      let regHist = [];
      if (Array.isArray(hist) && hist.length > 0) {
        regHist = registerTracks(hist);
        set({ historyTracks: regHist });
        setStorage("history_tracks", regHist);
      }

      // Auto-select starting track from real user history or liked songs if none selected
      const cur = get().currentId;
      if (!cur || !tracksMap.has(cur)) {
        const candidate = regHist[0] || regLiked[0];
        if (candidate) {
          set({
            currentId: candidate.id,
            duration: candidate.duration || 200,
          });
          get().loadRelatedMusic(candidate.id, true);
        }
      }

      // 5. Trending / Charts
      const charts = await fetchCharts();
      if (Array.isArray(charts) && charts.length > 0) {
        const regCharts = registerTracks(charts);
        set({ trendingTracks: regCharts });
      }

      // 6. Home Shelves
      const home = await fetchUserHome();
      if (home && Array.isArray(home.shelves)) {
        home.shelves.forEach((sh) => {
          if (Array.isArray(sh.tracks)) registerTracks(sh.tracks);
          if (Array.isArray(sh.items)) registerTracks(sh.items);
        });
        set({ homeShelves: home.shelves });
      }
    } catch (err) {
      console.warn("Backend sync notice:", err);
    }
  },
}));

// Setup global audio listeners + 90-120Hz rAF time sync when playing
if (globalAudio) {
  let rafId = 0;
  const syncLoop = () => {
    if (!globalAudio.paused && !globalAudio.seeking && !isNaN(globalAudio.currentTime)) {
      const exact = globalAudio.currentTime;
      const curSeconds = Math.floor(exact);
      const state = usePlayer.getState();
      if (state.time !== curSeconds || Math.abs(state.exactTime - exact) >= 0.03) {
        usePlayer.setState({ time: curSeconds, exactTime: exact });
      }
      rafId = requestAnimationFrame(syncLoop);
    } else {
      rafId = 0;
    }
  };

  globalAudio.addEventListener("play", () => {
    ensureBeatAnalyser(globalAudio, usePlayer.getState);
    if (!rafId) rafId = requestAnimationFrame(syncLoop);
  });

  globalAudio.addEventListener("pause", () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  });

  globalAudio.addEventListener("timeupdate", () => {
    if (!isNaN(globalAudio.currentTime) && !globalAudio.seeking) {
      const exact = globalAudio.currentTime;
      const curSeconds = Math.floor(exact);
      const state = usePlayer.getState();
      if (state.time !== curSeconds || Math.abs(state.exactTime - exact) >= 0.05) {
        usePlayer.setState({ time: curSeconds, exactTime: exact });
      }
    }
  });

  globalAudio.addEventListener("durationchange", () => {
    if (!isNaN(globalAudio.duration) && globalAudio.duration > 0) {
      usePlayer.setState({ duration: Math.floor(globalAudio.duration) });
    }
  });

  globalAudio.addEventListener("ended", () => {
    usePlayer.getState().next();
  });
}
