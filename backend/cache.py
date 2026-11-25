"""
In-memory and disk-persisted TTL cache for resolved stream URLs and user personalized data.
Keyed by videoId, expires after STREAM_TTL seconds (default 55 min).
User personalized data is backed by disk in %APPDATA%/NightWave/user_cache.json for 0ms cold starts.
"""
import os
import json
import time
from pathlib import Path
from threading import Lock
from typing import Optional

STREAM_TTL = 55 * 60  # 55 minutes (YouTube signed URLs expire at ~60 min)
LYRICS_TTL = 24 * 60 * 60  # 24 hours
SUGGESTIONS_TTL = 60 * 60  # 1 hour
USER_CACHE_TTL = 15 * 60   # 15 minutes for user personalized shelves & playlists
STATUS_CACHE_TTL = 7 * 24 * 60 * 60  # 7 days for user auth status/profile

_stream_cache: dict[str, tuple[dict, float]] = {}
_lyrics_cache: dict[str, tuple[dict, float]] = {}
_suggestions_cache: dict[str, tuple[dict, float]] = {}
_user_cache: dict[str, tuple[dict, float]] = {}
_lock = Lock()


def _get_cache_file() -> Path:
    appdata = os.environ.get("APPDATA")
    if appdata:
        d = Path(appdata) / "NightWave"
        d.mkdir(parents=True, exist_ok=True)
        return d / "user_cache.json"
    return Path.cwd() / "user_cache.json"


USER_CACHE_FILE = _get_cache_file()


def _load_disk_user_cache():
    if USER_CACHE_FILE.exists():
        try:
            with open(USER_CACHE_FILE, "r", encoding="utf-8") as f:
                raw = json.load(f)
                now = time.time()
                for k, v in raw.items():
                    data = v.get("data")
                    ts = v.get("ts", now)
                    if data:
                        _user_cache[k] = (data, ts)
        except Exception as e:
            print(f"[NightWave Cache] Notice: could not read disk cache: {e}")


_load_disk_user_cache()


def _save_disk_user_cache():
    try:
        raw = {}
        with _lock:
            for k, (data, ts) in _user_cache.items():
                raw[k] = {"data": data, "ts": ts}
        with open(USER_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(raw, f)
    except Exception as e:
        print(f"[NightWave Cache] Notice: could not write disk cache: {e}")


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


def invalidate_stream(video_id: str) -> None:
    with _lock:
        _stream_cache.pop(video_id, None)


def get_lyrics(key: str) -> Optional[dict]:
    return _get(_lyrics_cache, key, LYRICS_TTL)


def set_lyrics(key: str, data: dict) -> None:
    _set(_lyrics_cache, key, data)


def get_suggestions(video_id: str) -> Optional[dict]:
    return _get(_suggestions_cache, video_id, SUGGESTIONS_TTL)


def set_suggestions(video_id: str, data: dict) -> None:
    _set(_suggestions_cache, video_id, data)


def get_user_cache(key: str) -> Optional[dict]:
    # user_status has longer persistence (7 days)
    ttl = STATUS_CACHE_TTL if key == "user_status" else USER_CACHE_TTL
    return _get(_user_cache, key, ttl)


def set_user_cache(key: str, data: dict) -> None:
    _set(_user_cache, key, data)
    _save_disk_user_cache()


def clear_user_cache() -> None:
    with _lock:
        _user_cache.clear()
    if USER_CACHE_FILE.exists():
        try:
            USER_CACHE_FILE.unlink(missing_ok=True)
        except Exception:
            pass


def invalidate_user_cache_prefix(prefix: str) -> None:
    with _lock:
        keys = [k for k in _user_cache if k.startswith(prefix)]
        for k in keys:
            _user_cache.pop(k, None)
    _save_disk_user_cache()
