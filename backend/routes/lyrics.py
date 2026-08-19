"""
GET /api/lyrics?title={title}&artist={artist}&duration={seconds}

Strategy:
1. Query LRCLIB (free, no key, LRC synced lyrics)
2. Fallback: return empty/plain if not found
Returns:
  { synced: true,  lines: [{time: float, text: str}, ...] }  — LRC format
  { synced: false, plain: str }                               — plain text
  { synced: false, plain: "" }                                — not found
"""
import re
import httpx
from fastapi import APIRouter, Query
from backend.cache import get_lyrics, set_lyrics

router = APIRouter()
LRCLIB_BASE = "https://lrclib.net/api"


def _parse_lrc(lrc_text: str) -> list[dict]:
    """Parse LRC format into [{time: float, text: str}]."""
    lines = []
    pattern = re.compile(r"\[(\d{1,3}):(\d{2})\.(\d{2,3})\](.*)")
    for raw in lrc_text.splitlines():
        m = pattern.match(raw.strip())
        if not m:
            continue
        minutes, seconds, centiseconds, text = m.groups()
        time_secs = int(minutes) * 60 + int(seconds) + int(centiseconds) / (
            100 if len(centiseconds) == 2 else 1000
        )
        text = text.strip()
        if text:  # skip empty lines (instrumental markers etc.)
            lines.append({"time": round(time_secs, 2), "text": text})
    return sorted(lines, key=lambda x: x["time"])


@router.get("/lyrics")
async def lyrics(
    title: str = Query(...),
    artist: str = Query(""),
    duration: int = Query(0, ge=0),
):
    cache_key = f"{title.lower()}::{artist.lower()}"
    cached = get_lyrics(cache_key)
    if cached:
        return cached

    async with httpx.AsyncClient(timeout=10) as client:
        # --- Strategy 1: LRCLIB get (exact match) ---
        try:
            params = {"track_name": title, "artist_name": artist}
            if duration > 0:
                params["duration"] = duration
            r = await client.get(f"{LRCLIB_BASE}/get", params=params)

            if r.status_code == 200:
                data = r.json()
                synced_lrc = data.get("syncedLyrics") or ""
                plain_text = data.get("plainLyrics") or ""

                if synced_lrc:
                    parsed = _parse_lrc(synced_lrc)
                    result = {"synced": True, "lines": parsed}
                    set_lyrics(cache_key, result)
                    return result
                elif plain_text:
                    result = {"synced": False, "plain": plain_text}
                    set_lyrics(cache_key, result)
                    return result
        except Exception:
            pass

        # --- Strategy 2: LRCLIB search fallback ---
        try:
            r = await client.get(
                f"{LRCLIB_BASE}/search",
                params={"q": f"{title} {artist}".strip()},
            )
            if r.status_code == 200:
                results = r.json()
                # pick best match by duration proximity
                best = None
                best_diff = float("inf")
                for item in results[:5]:
                    item_dur = item.get("duration") or 0
                    diff = abs(item_dur - duration) if duration else 0
                    if diff < best_diff:
                        best_diff = diff
                        best = item

                if best:
                    synced_lrc = best.get("syncedLyrics") or ""
                    plain_text = best.get("plainLyrics") or ""
                    if synced_lrc:
                        parsed = _parse_lrc(synced_lrc)
                        result = {"synced": True, "lines": parsed}
                        set_lyrics(cache_key, result)
                        return result
                    elif plain_text:
                        result = {"synced": False, "plain": plain_text}
                        set_lyrics(cache_key, result)
                        return result
        except Exception:
            pass

    # Not found
    result = {"synced": False, "plain": ""}
    set_lyrics(cache_key, result)
    return result
