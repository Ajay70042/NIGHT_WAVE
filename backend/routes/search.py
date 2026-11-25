"""
GET /api/search?q={query}&limit={n}
Returns top matching tracks via ytmusicapi (unauthorized mode — no API key needed).
Supports song search, direct YouTube Music / YouTube URL pasting, and trending.
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


def _extract_video_id(url_or_id: str) -> str:
    """Extract YouTube / YouTube Music video ID from URL or string."""
    s = url_or_id.strip()
    # Direct 11-char ID
    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", s):
        return s
    # music.youtube.com or youtube.com / watch?v=...
    match = re.search(r"(?:v=|vi=|youtu\.be/|embed/|shorts/)([a-zA-Z0-9_-]{11})", s)
    if match:
        return match.group(1)
    return ""


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, description="Search query or YouTube Music link"),
    limit: int = Query(20, ge=1, le=50),
):
    query_str = q.strip()
    if not query_str:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    extracted_id = _extract_video_id(query_str)
    if extracted_id:
        try:
            # Try to fetch metadata for the exact video/song ID
            song_data = _ytm.get_song(extracted_id)
            video_details = song_data.get("videoDetails", {})
            title = video_details.get("title", "YouTube Track")
            author = video_details.get("author", "YouTube Artist")
            thumbnails = video_details.get("thumbnail", {}).get("thumbnails", [])
            thumbnail = _best_thumbnail(thumbnails)
            dur_secs = int(video_details.get("lengthSeconds", 0))
            minutes = dur_secs // 60
            seconds = dur_secs % 60
            return {
                "tracks": [{
                    "id": extracted_id,
                    "title": title,
                    "artist": author,
                    "album": "YouTube Music",
                    "thumbnail": thumbnail,
                    "duration": dur_secs,
                    "durationStr": f"{minutes}:{seconds:02d}",
                }],
                "query": q,
                "count": 1,
            }
        except Exception:
            pass  # Fallback to search below

    try:
        results = _ytm.search(query_str, filter="songs", limit=limit)
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


@router.get("/charts")
async def charts(country: str = Query("GLOBAL", description="Country code e.g. US, IN, GLOBAL")):
    """Get current top trending songs directly from YouTube Music."""
    try:
        data = _ytm.get_charts(country=country if country != "GLOBAL" else "US")
        songs_list = data.get("videos", {}).get("items", []) or data.get("tracks", {}).get("items", [])
    except Exception:
        # Fallback to search query
        try:
            songs_list = _ytm.search("Top Global Hits 2024", filter="songs", limit=20)
        except Exception:
            songs_list = []

    tracks = []
    for item in songs_list:
        try:
            v_id = item.get("videoId", "")
            if not v_id:
                continue
            title = item.get("title", "Unknown")
            artists = item.get("artists", [])
            artist = ", ".join(a.get("name", "") for a in artists) if artists else "Unknown Artist"
            thumbnails = item.get("thumbnails", []) or item.get("thumbnail", [])
            thumbnail = _best_thumbnail(thumbnails)
            tracks.append({
                "id": v_id,
                "title": title,
                "artist": artist,
                "album": "YouTube Music Charts",
                "thumbnail": thumbnail,
                "duration": 0,
                "durationStr": "3:30",
            })
        except Exception:
            continue

    return {"tracks": tracks, "count": len(tracks)}
