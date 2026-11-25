"""
GET /api/stream?id={videoId}         → returns stream metadata + direct URL
GET /api/stream/audio?id={videoId}   → streams audio bytes with HTTP 206 Range support for native HTML5 <audio>
GET /api/proxy?id={videoId}          → redirects browser to direct YouTube URL
"""
import asyncio
import sys
import threading
import httpx
from fastapi import APIRouter, Query, Request, HTTPException, Response
from fastapi.responses import RedirectResponse, StreamingResponse
import yt_dlp

try:
    from backend.cache import get_stream, set_stream, invalidate_stream
except ImportError:
    from cache import get_stream, set_stream, invalidate_stream

router = APIRouter()

# Shared persistent HTTP client for streaming audio bytes efficiently
_http_client: httpx.AsyncClient = None

def get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=25, max_connections=50),
        )
    return _http_client

# Concurrency control & deduplication for stream extraction
_resolve_semaphore = asyncio.Semaphore(4)
_in_flight_tasks: dict[str, asyncio.Task] = {}

_ydl_opts_base = {
    "format": "ba/b",
    "quiet": True,
    "no_warnings": True,
    "check_formats": False,
    "skip_download": True,
    "cachedir": False,
    "socket_timeout": 7,
}

_thread_local = threading.local()

def _get_thread_ydl() -> yt_dlp.YoutubeDL:
    if not hasattr(_thread_local, "ydl"):
        opts = dict(_ydl_opts_base)
        opts["extractor_args"] = {"youtube": {"player_client": ["android"]}}
        _thread_local.ydl = yt_dlp.YoutubeDL(opts)
    return _thread_local.ydl

def _get_thread_ydl_fallback() -> yt_dlp.YoutubeDL:
    if not hasattr(_thread_local, "ydl_fb"):
        fb_opts = dict(_ydl_opts_base)
        fb_opts["extractor_args"] = {"youtube": {"player_client": ["web"]}}
        _thread_local.ydl_fb = yt_dlp.YoutubeDL(fb_opts)
    return _thread_local.ydl_fb

def _extract_sync(video_id: str) -> dict:
    url = f"https://www.youtube.com/watch?v={video_id}"
    info = None
    
    # Fast android client with per-thread YDL (zero lock contention)
    try:
        info = _get_thread_ydl().extract_info(url, download=False)
    except Exception as e:
        print(f"[NightWave] Primary extractor exception for {video_id}: {e}, falling back to web client")
        try:
            info = _get_thread_ydl_fallback().extract_info(url, download=False)
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Failed to resolve track: {exc}")

    if not info:
        raise HTTPException(status_code=502, detail="No track info extracted")

    formats = info.get("formats", [])
    audio_formats = [
        f for f in formats
        if f.get("url") and f.get("acodec") not in (None, "none")
    ]

    stream_url = None
    ext = "m4a"
    if audio_formats:
        # Choose highest bitrate available without restricting to m4a
        chosen = max(audio_formats, key=lambda f: (f.get("abr") or 0, f.get("tbr") or 0))
        stream_url = chosen.get("url")
        ext = chosen.get("ext", "m4a")
    elif info.get("url"):
        stream_url = info.get("url")
        ext = info.get("ext", "m4a")

    if not stream_url:
        raise HTTPException(status_code=502, detail="No audio stream URL available")

    mime_map = {
        "m4a": "audio/mp4",
        "webm": "audio/webm",
        "mp4": "audio/mp4",
        "opus": "audio/ogg",
    }
    return {
        "url": stream_url,
        "headers": info.get("http_headers", {}),
        "mimeType": mime_map.get(ext, "audio/mp4"),
        "duration": float(info.get("duration") or 0.0),
        "ext": ext,
        "title": info.get("title", ""),
        "uploader": info.get("uploader", ""),
    }


async def _resolve(video_id: str) -> dict:
    """
    Deduplicated, concurrency-controlled stream extraction.
    If multiple callers request the same videoId concurrently, they share the same resolution task.
    """
    cached = get_stream(video_id)
    if cached:
        return cached

    # Check if an extraction for this video_id is already in flight
    if video_id in _in_flight_tasks:
        task = _in_flight_tasks[video_id]
        if not task.done():
            return await task

    loop = asyncio.get_event_loop()

    async def _do_resolve():
        async with _resolve_semaphore:
            # Re-check cache inside semaphore lock
            c = get_stream(video_id)
            if c:
                return c
            data = await loop.run_in_executor(None, _extract_sync, video_id)
            set_stream(video_id, data)
            return data

    task = asyncio.create_task(_do_resolve())
    _in_flight_tasks[video_id] = task

    try:
        data = await task
        return data
    finally:
        _in_flight_tasks.pop(video_id, None)


@router.get("/stream")
async def stream_info(id: str = Query(..., min_length=5)):
    """Returns stream metadata including direct URL. Used for prefetching and metadata."""
    cached = get_stream(id)
    if cached:
        return {**cached, "cached": True}
    data = await _resolve(id)
    return {**data, "cached": False}


@router.api_route("/stream/audio", methods=["GET", "HEAD"])
async def stream_audio_bytes(request: Request, id: str = Query(..., min_length=5)):
    """
    Streams audio bytes directly to the browser with HTTP 206 Partial Content support.
    Supports both GET and HEAD requests for native HTML5 <audio> streaming.
    """
    data = await _resolve(id)
    stream_url = data.get("url")
    if not stream_url:
        raise HTTPException(status_code=404, detail="Audio stream not found")

    client = get_http_client()
    upstream_headers = dict(data.get("headers") or {})
    range_header = request.headers.get("range")
    if range_header:
        upstream_headers["Range"] = range_header

    try:
        req = client.build_request("GET", stream_url, headers=upstream_headers)
        res = await client.send(req, stream=True)
    except Exception as e:
        # Retry with fresh extraction if connection error occurred
        invalidate_stream(id)
        data = await _resolve(id)
        stream_url = data.get("url")
        req = client.build_request("GET", stream_url, headers=upstream_headers)
        res = await client.send(req, stream=True)

    # If cached URL expired or upstream returned error (e.g. 403 Forbidden from expired Google CDN token)
    if res.status_code in (403, 404, 410) or res.status_code >= 500:
        await res.aclose()
        invalidate_stream(id)
        try:
            data = await _resolve(id)
            stream_url = data.get("url")
            upstream_headers = dict(data.get("headers") or {})
            if range_header:
                upstream_headers["Range"] = range_header
            req = client.build_request("GET", stream_url, headers=upstream_headers)
            res = await client.send(req, stream=True)
        except Exception as retry_err:
            raise HTTPException(status_code=502, detail=f"Stream retry failed: {retry_err}")

    resp_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
    }
    if "content-range" in res.headers:
        resp_headers["Content-Range"] = res.headers["content-range"]
    if "content-length" in res.headers:
        resp_headers["Content-Length"] = res.headers["content-length"]

    raw_ct = res.headers.get("content-type") or data.get("mimeType", "audio/mp4")
    if "mp4" in raw_ct.lower():
        audio_ct = "audio/mp4"
    elif "webm" in raw_ct.lower():
        audio_ct = "audio/webm"
    elif "ogg" in raw_ct.lower():
        audio_ct = "audio/ogg"
    else:
        audio_ct = "audio/mp4"

    resp_headers["Content-Type"] = audio_ct

    # If client just requested HEAD (e.g. browser probe before playback)
    if request.method == "HEAD":
        await res.aclose()
        return Response(status_code=res.status_code, headers=resp_headers)

    async def stream_generator():
        try:
            # Single continuous stream loop (never break/restart aiter_bytes)
            async for chunk in res.aiter_bytes(chunk_size=65536):
                yield chunk
        finally:
            await res.aclose()

    return StreamingResponse(
        stream_generator(),
        status_code=res.status_code,
        headers=resp_headers,
        media_type=audio_ct,
    )


@router.get("/proxy")
async def proxy_audio(id: str = Query(..., min_length=5)):
    """Redirects browser to direct YouTube audio URL."""
    data = await _resolve(id)
    return RedirectResponse(url=data["url"], status_code=302)
