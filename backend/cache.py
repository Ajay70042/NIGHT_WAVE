"""
In-memory TTL cache for resolved stream URLs.
Keyed by videoId, expires after STREAM_TTL seconds (default 55 min).
"""
import time
from threading import Lock
from typing import Optional

STREAM_TTL = 55 * 60  # 55 minutes (YouTube signed URLs expire at ~60 min)
LYRICS_TTL = 24 * 60 * 60  # 24 hours

_stream_cache: dict[str, tuple[dict, float]] = {}
_lyrics_cache: dict[str, tuple[dict, float]] = {}
_lock = Lock()


def _get(cache: dict, key: str, ttl: int) -> Optional[dict]:
    with _lock:
        entry = cache.get(key)
        if entry and (time.time() - entry[1]) < ttl:
            return entry[0]
        if entry:
            del cache[key]
        return None


def _set(cache: dict, key: str, value: dict) -> None:
    with _lock:
        cache[key] = (value, time.time())


def get_stream(video_id: str) -> Optional[dict]:
    return _get(_stream_cache, video_id, STREAM_TTL)


def set_stream(video_id: str, data: dict) -> None:
    _set(_stream_cache, video_id, data)


def get_lyrics(key: str) -> Optional[dict]:
    return _get(_lyrics_cache, key, LYRICS_TTL)


def set_lyrics(key: str, data: dict) -> None:
    _set(_lyrics_cache, key, data)
