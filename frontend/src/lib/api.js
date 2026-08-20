const rawBase = import.meta.env.VITE_API_URL?.trim();
const BASE = rawBase
  ? rawBase.replace(/\/+$/, "").endsWith("/api")
    ? rawBase.replace(/\/+$/, "")
    : `${rawBase.replace(/\/+$/, "")}/api`
  : "/api";

export async function searchTracks(query, limit = 20) {
  const res = await fetch(
    `${BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = await res.json();
  return data.tracks || data;
}

export async function resolveStream(videoId) {
  const res = await fetch(`${BASE}/stream?id=${encodeURIComponent(videoId)}`);
  if (!res.ok) throw new Error(`Stream resolve failed: ${res.status}`);
  const data = await res.json();

  // Use the direct YouTube URL — browsers can play googlevideo.com URLs natively.
  // Server-side proxying fails (403) because YouTube blocks non-browser requests.
  // The browser has a real TLS fingerprint and can fetch the audio directly.
  return {
    ...data,
    url: data.url,          // direct googlevideo.com URL
    mimeType: data.mimeType || "audio/mp4",
  };
}

export async function fetchLyrics(title, artist, duration = 0) {
  const params = new URLSearchParams({
    title,
    artist,
    duration: String(Math.round(duration)),
  });
  const res = await fetch(`${BASE}/lyrics?${params}`);
  if (!res.ok) throw new Error(`Lyrics fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSuggestions(videoId, limit = 20) {
  const res = await fetch(`${BASE}/suggestions?videoId=${encodeURIComponent(videoId)}&limit=${limit}`);
  if (!res.ok) throw new Error(`Suggestions fetch failed: ${res.status}`);
  const data = await res.json();
  return data.tracks || [];
}

