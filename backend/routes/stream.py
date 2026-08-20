"""
GET /api/stream?id={videoId}   → returns stream metadata + direct URL
GET /api/proxy?id={videoId}    → redirects browser to direct YouTube URL

YouTube blocks server-side fetches (403) due to IP-level restrictions.
The browser can play the URL directly — we just need to redirect it there.
The URL is same-domain (googlevideo.com) which browsers can play via <audio>.
"""
import asyncio
import sys
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import RedirectResponse
try:
    from backend.cache import get_stream, set_stream
except ImportError:
    from cache import get_stream, set_stream

router = APIRouter()


async def _resolve(video_id: str) -> dict:
    """Run yt-dlp to get the best audio stream URL + metadata."""
    url = f"https://www.youtube.com/watch?v={video_id}"
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "--no-playlist",
        "--format", "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio",
        "--print", "%(url)s\n%(duration)s\n%(ext)s\n%(title)s\n%(uploader)s",
        "--quiet",
        "--no-warnings",
        url,
    ]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="yt-dlp timed out")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"yt-dlp error: {exc}")

    if proc.returncode != 0:
        err = stderr.decode(errors="replace").strip()
        raise HTTPException(status_code=502, detail=f"yt-dlp failed: {err[:300]}")

    lines = stdout.decode(errors="replace").strip().splitlines()
    if not lines or not lines[0].startswith("http"):
        raise HTTPException(status_code=502, detail="yt-dlp returned no URL")

    stream_url = lines[0].strip()
    try:
        duration = float(lines[1].strip())
    except (IndexError, ValueError):
        duration = 0.0
    ext      = lines[2].strip() if len(lines) > 2 else "m4a"
    title    = lines[3].strip() if len(lines) > 3 else ""
    uploader = lines[4].strip() if len(lines) > 4 else ""

    mime_map  = {"m4a": "audio/mp4", "webm": "audio/webm", "mp4": "audio/mp4", "opus": "audio/ogg"}
    mime_type = mime_map.get(ext, "audio/mp4")

    return {
        "url": stream_url,
        "mimeType": mime_type,
        "duration": duration,
        "ext": ext,
        "title": title,
        "uploader": uploader,
    }


@router.get("/stream")
async def stream_info(id: str = Query(..., min_length=5)):
    """Returns stream metadata including direct URL. Frontend uses this URL directly."""
    cached = get_stream(id)
    if cached:
        return {**cached, "cached": True}
    data = await _resolve(id)
    set_stream(id, data)
    return {**data, "cached": False}


@router.get("/proxy")
async def proxy_audio(id: str = Query(..., min_length=5)):
    """
    Redirects browser to the direct YouTube audio URL.
    Server-side fetch is blocked (403) by YouTube's IP restrictions,
    but browsers can play the URL directly since they have real TLS fingerprints.
    """
    cached = get_stream(id)
    if cached:
        data = cached
    else:
        data = await _resolve(id)
        set_stream(id, data)
    # 302 redirect — browser follows it and plays audio directly
    return RedirectResponse(url=data["url"], status_code=302)
