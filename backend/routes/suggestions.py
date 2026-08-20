"""
GET /api/suggestions?videoId={id}&limit={n}
Returns suggested tracks based on the provided video ID via ytmusicapi radio feature.
"""
from fastapi import APIRouter, Query, HTTPException
from ytmusicapi import YTMusic
try:
    from backend.routes.search import _best_thumbnail, _parse_duration
    from backend.cache import get_suggestions, set_suggestions
except ImportError:
    from routes.search import _best_thumbnail, _parse_duration
    from cache import get_suggestions, set_suggestions

router = APIRouter()
_ytm = YTMusic()

@router.get("/suggestions")
async def suggestions(
    videoId: str = Query(..., min_length=1, description="Source video ID for suggestions"),
    limit: int = Query(20, ge=1, le=50),
):
    # Check cache first
    cached = get_suggestions(f"{videoId}:{limit}")
    if cached:
        return cached

    tracks = []
    try:
        # radio=True triggers continuous autoplay/discovery algorithms
        res = _ytm.get_watch_playlist(videoId=videoId, radio=True, limit=limit)
        results = res.get("tracks", [])
    except Exception as exc:
        results = []

    for item in results:
        try:
            v_id = item.get("videoId", "")
            if not v_id or v_id == videoId:
                continue

            title = item.get("title", "Unknown")
            artists = item.get("artists", [])
            artist = ", ".join(a.get("name", "") for a in artists) if artists else "Unknown Artist"
            
            album_data = item.get("album") or {}
            album = album_data.get("name", "") if isinstance(album_data, dict) else ""
            
            thumbnails = item.get("thumbnail", [])
            thumbnail = _best_thumbnail(thumbnails)
            
            duration_str = item.get("length", "0:00")
            duration_secs = _parse_duration(duration_str)

            tracks.append({
                "id": v_id,
                "title": title,
                "artist": artist,
                "album": album,
                "thumbnail": thumbnail,
                "duration": duration_secs,
                "durationStr": duration_str,
            })
        except Exception:
            continue

    data = {"tracks": tracks, "count": len(tracks)}
    if tracks:
        set_suggestions(f"{videoId}:{limit}", data)
    return data

