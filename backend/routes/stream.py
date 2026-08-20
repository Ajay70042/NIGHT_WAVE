"""
GET /api/stream?id={videoId}         → returns stream metadata + direct URL
GET /api/stream/audio?id={videoId}   → streams audio bytes with HTTP 206 Range support for native HTML5 <audio>
GET /api/proxy?id={videoId}          → redirects browser to direct YouTube URL
"""
import asyncio
import sys
import httpx
from fastapi import APIRouter, Query, Request, HTTPException
from fastapi.responses import RedirectResponse, StreamingResponse
try:
    from backend.cache import get_stream, set_stream
except ImportError:
    from cache import get_stream, set_stream

router = APIRouter()


async def _resolve(video_id: str) -> dict:
    """Run yt-dlp to get the best audio stream URL + metadata using android/ios clients (no JS challenge required)."""
    def _extract_sync():
        import yt_dlp
        url = f"https://www.youtube.com/watch?v={video_id}"
        ydl_opts = {
            "format": "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
            "quiet": True,
            "no_warnings": True,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "ios", "web_creator", "mweb"]
                }
            },
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            ext = info.get("ext", "m4a")
            mime_map = {"m4a": "audio/mp4", "webm": "audio/webm", "mp4": "audio/mp4", "opus": "audio/ogg"}
            return {
                "url": info.get("url"),
                "headers": info.get("http_headers", {}),
                "mimeType": mime_map.get(ext, "audio/mp4"),
                "duration": float(info.get("duration") or 0.0),
                "ext": ext,
                "title": info.get("title", ""),
                "uploader": info.get("uploader", ""),
            }

    try:
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, _extract_sync)
        if not data or not data.get("url"):
            raise HTTPException(status_code=502, detail="yt-dlp returned no stream URL")
        return data
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"yt-dlp error: {exc}")


@router.get("/stream")
async def stream_info(id: str = Query(..., min_length=5)):
    """Returns stream metadata including direct URL. Frontend uses this URL directly."""
    cached = get_stream(id)
    if cached:
        return {**cached, "cached": True}
    data = await _resolve(id)
    set_stream(id, data)
    return {**data, "cached": False}


@router.get("/stream/audio")
async def stream_audio_bytes(request: Request, id: str = Query(..., min_length=5)):
    """
    Streams audio bytes directly to the browser with HTTP 206 Partial Content support.
    Enables native HTML5 <audio> playback on mobile (iOS/Android) with uninterrupted
    background playback when the screen is locked or app is minimized.
    """
    cached = get_stream(id)
    if cached:
        data = cached
    else:
        data = await _resolve(id)
        set_stream(id, data)

    stream_url = data.get("url")
    if not stream_url:
        raise HTTPException(status_code=404, detail="Audio stream not found")

    upstream_headers = dict(data.get("headers") or {})
    range_header = request.headers.get("range")
    if range_header:
        upstream_headers["Range"] = range_header

    client = httpx.AsyncClient(timeout=30)
    try:
        req = client.build_request("GET", stream_url, headers=upstream_headers)
        res = await client.send(req, stream=True)
    except Exception as e:
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Upstream stream error: {e}")

    async def stream_generator():
        try:
            async for chunk in res.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await res.aclose()
            await client.aclose()

    resp_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
    }
    if "content-range" in res.headers:
        resp_headers["Content-Range"] = res.headers["content-range"]
    if "content-length" in res.headers:
        resp_headers["Content-Length"] = res.headers["content-length"]
    if "content-type" in res.headers:
        resp_headers["Content-Type"] = res.headers["content-type"]
    else:
        resp_headers["Content-Type"] = data.get("mimeType", "audio/mp4")

    return StreamingResponse(
        stream_generator(),
        status_code=res.status_code,
        headers=resp_headers,
        media_type=resp_headers.get("Content-Type", "audio/mp4"),
    )


@router.get("/proxy")
async def proxy_audio(id: str = Query(..., min_length=5)):
    """
    Redirects browser to direct YouTube audio URL.
    """
    cached = get_stream(id)
    if cached:
        data = cached
    else:
        data = await _resolve(id)
        set_stream(id, data)
    return RedirectResponse(url=data["url"], status_code=302)

