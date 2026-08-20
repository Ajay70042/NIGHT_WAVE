import { Capacitor } from "@capacitor/core";

let rawBase = (import.meta.env.VITE_API_URL || "").trim();
// Strip surrounding quotes if entered with quotes in Vercel UI
rawBase = rawBase.replace(/^["']+|["']+$/g, "").trim();

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const DEFAULT_PROD_API = "https://nightwave-api.onrender.com/api";

const BASE = rawBase
  ? rawBase.replace(/\/+$/, "").endsWith("/api")
    ? rawBase.replace(/\/+$/, "")
    : `${rawBase.replace(/\/+$/, "")}/api`
  : isLocalhost
    ? "/api"
    : DEFAULT_PROD_API;

/**
 * Helper to fetch with retry for Render free-tier cold starts
 */
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 1500) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get("content-type") || "";

      // If we got HTML back when expecting JSON (e.g. Vercel SPA rewrite when VITE_API_URL is missing)
      if (contentType.includes("text/html")) {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        if (!isLocalhost && !rawBase) {
          throw new Error(
            "VITE_API_URL is not set on Vercel. Please add your Render backend URL to Vercel Environment Variables and redeploy."
          );
        }
      }

      if (!res.ok) {
        // If 502/503/504 (backend starting up on Render), retry
        if ((res.status === 502 || res.status === 503 || res.status === 504) && i < retries) {
          await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
          continue;
        }
        throw new Error(`Server returned status ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      if (i < retries && !err.message.includes("VITE_API_URL")) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

export async function searchTracks(query, limit = 20) {
  const data = await fetchWithRetry(
    `${BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  return data.tracks || data;
}

export async function resolveStream(videoId) {
  const data = await fetchWithRetry(`${BASE}/stream?id=${encodeURIComponent(videoId)}`);
  return {
    ...data,
    url: data.url,
    mimeType: data.mimeType || "audio/mp4",
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
  if (videoId) {
    params.set("videoId", videoId);
  }
  return await fetchWithRetry(`${BASE}/lyrics?${params}`);
}

export async function fetchSuggestions(videoId, limit = 20) {
  const data = await fetchWithRetry(
    `${BASE}/suggestions?videoId=${encodeURIComponent(videoId)}&limit=${limit}`
  );
  return data.tracks || [];
}

export function pingHealth() {
  fetch(`${BASE}/health`).catch(() => {});
}

// ── Prefetch / Cache Warming ──────────────────────────────────────────────────
// Call this on hover to silently resolve the stream URL so when the user clicks
// "Play", the backend already has it cached → near-instant playback start.
const _prefetchInFlight = new Set();

export function prefetchStream(videoId) {
  if (!videoId || _prefetchInFlight.has(videoId)) return;
  _prefetchInFlight.add(videoId);
  fetch(`${BASE}/stream?id=${encodeURIComponent(videoId)}`)
    .catch(() => {})
    .finally(() => {
      // Keep in set for 60s to avoid hammering
      setTimeout(() => _prefetchInFlight.delete(videoId), 60_000);
    });
}


