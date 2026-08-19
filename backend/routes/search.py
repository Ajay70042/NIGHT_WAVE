"""
GET /api/search?q={query}&limit={n}
Returns top matching tracks via ytmusicapi (unauthorized mode — no API key needed).
"""
from fastapi import APIRouter, Query, HTTPException
from ytmusicapi import YTMusic
import re

router = APIRouter()
_ytm = YTMusic()  # unauthorized mode


def _parse_duration(duration_str: str) -> int:
    """Convert 'M:SS' or 'H:MM:SS' string to total seconds."""
    if not duration_str:
        return 0
    parts = duration_str.split(":")
    try:
        parts = [int(p) for p in parts]
        if len(parts) == 2:
            return parts[0] * 60 + parts[1]
        if len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
    except ValueError:
        pass
    return 0


def _best_thumbnail(thumbnails: list[dict]) -> str:
    """Pick highest-res thumbnail available."""
    if not thumbnails:
        return ""
    sorted_thumbs = sorted(
        thumbnails,
        key=lambda t: t.get("width", 0) * t.get("height", 0),
        reverse=True,
    )
    return sorted_thumbs[0].get("url", "")


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=50),
):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        results = _ytm.search(q, filter="songs", limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"YTMusic search error: {exc}")

    tracks = []
    for item in results:
        try:
            video_id = item.get("videoId", "")
            if not video_id:
                continue

            title = item.get("title", "Unknown")
            artists = item.get("artists", [])
            artist = ", ".join(a.get("name", "") for a in artists) if artists else "Unknown Artist"
            album_data = item.get("album") or {}
            album = album_data.get("name", "") if isinstance(album_data, dict) else ""
            thumbnails = item.get("thumbnails", [])
            thumbnail = _best_thumbnail(thumbnails)
            duration_str = item.get("duration", "0:00")
            duration_secs = _parse_duration(duration_str)

            tracks.append({
                "id": video_id,
                "title": title,
                "artist": artist,
                "album": album,
                "thumbnail": thumbnail,
                "duration": duration_secs,
                "durationStr": duration_str,
            })
        except Exception:
            continue

    return {"tracks": tracks, "query": q, "count": len(tracks)}
