let rawBase = (import.meta.env.VITE_API_URL || "").trim();
rawBase = rawBase.replace(/^["']+|["']+$/g, "").trim();

const isElectron =
  typeof window !== "undefined" &&
  (Boolean(window.electronAPI) || window.location.protocol === "file:");

const isTauri =
  typeof window !== "undefined" &&
  Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__ || window.location.protocol === "tauri:");

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    isElectron ||
    isTauri);

const DEFAULT_PROD_API = "https://nightwave-api-r6i8.onrender.com/api";

// For Desktop (Tauri / Electron) and Localhost, ALWAYS use the local backend on port 8000
const BASE = isElectron || isTauri || isLocalhost
  ? "http://127.0.0.1:8000/api"
  : rawBase
    ? rawBase.replace(/\/+$/, "").endsWith("/api")
      ? rawBase.replace(/\/+$/, "")
      : `${rawBase.replace(/\/+$/, "")}/api`
    : DEFAULT_PROD_API;

// ─── Stream cache — avoids resolving the same track twice ────────
const _streamCache = new Map();     // videoId → { url, mimeType, ts }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min (YouTube CDN links expire ~6 min)

async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 300) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type") || "";

      if (contentType.includes("text/html")) {
        const isLocal =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1");
        if (!isLocal && !rawBase) {
          throw new Error("VITE_API_URL is not set. Please check backend connection.");
        }
      }

      if (!res.ok) {
        if ([502, 503, 504].includes(res.status) && i < retries) {
          await delay(delayMs * (i + 1));
          continue;
        }
        throw new Error(`Server returned status ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      if (i < retries) {
        await delay(delayMs * (i + 1));
        continue;
      }
      throw err;
    }
  }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function searchTracks(query) {
  const data = await fetchWithRetry(`${BASE}/search?q=${encodeURIComponent(query)}`);
  return data.tracks || [];
}

export async function fetchCharts() {
  try {
    const data = await fetchWithRetry(`${BASE}/charts`);
    return data.tracks || [];
  } catch (_) {
    return [];
  }
}

// ─── YouTube Music User Account Integration ───────────────────────────────
export async function checkUserStatus() {
  try {
    return await fetchWithRetry(`${BASE}/user/status`);
  } catch (_) {
    return { connected: false };
  }
}

export async function connectUserAccount(headersOrCookie) {
  const res = await fetch(`${BASE}/user/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ headers: headersOrCookie }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to connect YouTube Music account");
  }
  return data;
}

export async function disconnectUserAccount() {
  const res = await fetch(`${BASE}/user/disconnect`, { method: "POST" });
  return await res.json();
}

export async function fetchUserHome() {
  try {
    const data = await fetchWithRetry(`${BASE}/user/home`);
    return data;
  } catch (_) {
    return { shelves: [], authenticated: false };
  }
}

export async function fetchUserLiked() {
  try {
    const data = await fetchWithRetry(`${BASE}/user/liked`);
    return data.tracks || [];
  } catch (_) {
    return [];
  }
}

export async function fetchUserPlaylists() {
  try {
    const data = await fetchWithRetry(`${BASE}/user/playlists`);
    return data.playlists || [];
  } catch (_) {
    return [];
  }
}

export async function fetchPlaylistTracks(playlistId) {
  try {
    const data = await fetchWithRetry(`${BASE}/user/playlist/${encodeURIComponent(playlistId)}`);
    return data;
  } catch (_) {
    return { tracks: [] };
  }
}

export async function fetchUserHistory() {
  try {
    const data = await fetchWithRetry(`${BASE}/user/history`);
    return data.tracks || [];
  } catch (_) {
    return [];
  }
}

export async function fetchDiscoverMoods() {
  try {
    const data = await fetchWithRetry(`${BASE}/discover/moods`);
    return data.categories || [];
  } catch (_) {
    return [];
  }
}

export async function fetchDiscoverMoodPlaylists(params) {
  try {
    const data = await fetchWithRetry(`${BASE}/discover/mood/${encodeURIComponent(params)}`);
    return data.playlists || [];
  } catch (_) {
    return [];
  }
}

export async function likeSongOnYTM(videoId, liked = true) {
  try {
    const res = await fetch(`${BASE}/user/like`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, liked }),
    });
    return await res.json();
  } catch (_) {
    return { success: false };
  }
}

export async function recordPlayHistory(videoId) {
  try {
    await fetch(`${BASE}/user/history/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });
  } catch (_) {}
}

export async function createYTMPlaylist(title, description = "", videoIds = []) {
  const res = await fetch(`${BASE}/user/playlist/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, videoIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to create playlist");
  return data;
}

export async function addTracksToYTMPlaylist(playlistId, videoIds = []) {
  const res = await fetch(`${BASE}/user/playlist/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playlistId, videoIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to add to playlist");
  return data;
}

/**
 * resolveStream — fast path with in-memory cache.
 * Returns { url, mimeType } within ~200ms on repeat plays.
 */
export async function resolveStream(videoId) {
  // 1. Cache hit
  const cached = _streamCache.get(videoId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { url: cached.url, mimeType: cached.mimeType };
  }

  // 2. Try local backend first (never fallback to prod if on desktop/localhost)
  const hosts = isElectron || isLocalhost ? [BASE] : [BASE, DEFAULT_PROD_API];

  for (const host of hosts) {
    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`${host}/stream?id=${encodeURIComponent(videoId)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data?.url) {
          const result = { url: data.url, mimeType: data.mimeType || "audio/mp4" };
          _streamCache.set(videoId, { ...result, ts: Date.now() });
          return result;
        }
      }
    } catch (_) {}
  }

  // 3. Direct audio fallback
  return {
    url:      `${BASE}/stream/audio?id=${encodeURIComponent(videoId)}`,
    mimeType: "audio/mp4",
  };
}

export function getAudioStreamUrl(videoId) {
  return `${BASE}/stream/audio?id=${encodeURIComponent(videoId)}`;
}

export async function fetchLyrics(title, artist, duration = 0, videoId = "") {
  const params = new URLSearchParams({
    title,
    artist,
    duration: String(Math.round(duration)),
  });
  if (videoId) params.set("videoId", videoId);
  return await fetchWithRetry(`${BASE}/lyrics?${params}`);
}

export async function fetchSuggestions(videoId, limit = 20) {
  const data = await fetchWithRetry(
    `${BASE}/suggestions?videoId=${encodeURIComponent(videoId)}&limit=${limit}`
  );
  return data.tracks || [];
}

export async function pingHealth() {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch (_) {
    return false;
  }
}

export async function waitForBackend(maxRetries = 30, delayMs = 250) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch (_) {}
    await delay(delayMs);
  }
  return false;
}

// ─── Prefetch (warm the backend cache for the next track) ────────
const _prefetchInFlight = new Set();
export function prefetchStream(videoId) {
  if (!videoId || _prefetchInFlight.has(videoId) || _streamCache.has(videoId)) return;
  // Limit concurrent background prefetches to 2 to prevent overloading yt-dlp
  if (_prefetchInFlight.size >= 2) return;
  _prefetchInFlight.add(videoId);
  resolveStream(videoId)
    .catch(() => {})
    .finally(() => {
      _prefetchInFlight.delete(videoId);
    });
}
