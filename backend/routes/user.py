"""
Routes for YouTube Music user account connection & personalized data:
- Status check
- Connect (via browser headers / cookie)
- Disconnect
- Personalized Home Recommendations (get_home)
- Liked Songs / Favorites (get_liked_songs)
- Library Playlists (get_library_playlists)
- History (get_history)
"""
import os
import re
import json
import asyncio
from pathlib import Path
from fastapi import APIRouter, HTTPException, Body
from ytmusicapi import YTMusic
from ytmusicapi.helpers import get_authorization, sapisid_from_cookie
from ytmusicapi.auth.browser import initialize_headers

try:
    from backend.routes.search import _best_thumbnail, _parse_duration
except ImportError:
    from routes.search import _best_thumbnail, _parse_duration

try:
    from backend.cache import get_user_cache, set_user_cache, clear_user_cache, invalidate_user_cache_prefix
except ImportError:
    from cache import get_user_cache, set_user_cache, clear_user_cache, invalidate_user_cache_prefix

router = APIRouter()

# Path to store authenticated credentials permanently (AppData only, never bundled dev files)
def _get_auth_file() -> Path:
    appdata = os.environ.get("APPDATA")
    if appdata:
        d = Path(appdata) / "NightWave"
        d.mkdir(parents=True, exist_ok=True)
        return d / "auth.json"
    return Path.cwd() / "auth.json"

AUTH_FILE = _get_auth_file()

_user_ytm: YTMusic | None = None


def get_ytm() -> tuple[YTMusic, bool]:
    """Returns (ytmusic_instance, is_authenticated)"""
    global _user_ytm
    if _user_ytm is not None:
        return _user_ytm, True

    if AUTH_FILE.exists():
        try:
            with open(AUTH_FILE, "r", encoding="utf-8") as f:
                auth_data = json.load(f)
            _user_ytm = YTMusic(auth_data)
            return _user_ytm, True
        except Exception as e:
            print(f"[NightWave] Failed to load auth.json: {e}")

    return YTMusic(), False


def _build_auth_dict(raw_cookie_or_headers: str) -> dict:
    """
    Build a valid ytmusicapi browser-auth dict from raw cookie string or raw browser headers.
    Ensures:
      - Duplicate cookies are resolved in favor of the later (YouTube-specific) values.
      - '__Secure-3PAPISID' is present in the cookie string.
      - Default browser headers (user-agent, accept, content-type, origin) are present.
      - 'x-goog-authuser' is set.
      - 'authorization' contains a valid SAPISIDHASH.
    """
    raw = raw_cookie_or_headers.strip()

    # Detect if it's a raw cookie value (no "header: value" lines) or headers block
    if not any(line.strip().lower().startswith(("cookie:", "accept:", "authorization:"))
               for line in raw.splitlines()):
        cookie_raw_str = raw
        headers_dict: dict = {}
    else:
        headers_dict = {}
        cookie_raw_str = ""
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            if ":" in line:
                key, _, val = line.partition(":")
                key = key.strip().lower()
                val = val.strip()
                if key == "cookie":
                    cookie_raw_str = val
                else:
                    headers_dict[key] = val

    if not cookie_raw_str:
        raise ValueError("No cookie value found in provided headers")

    # Deduplicate cookies: when Electron passes cookies from both .google.com and .youtube.com,
    # later cookies belong to youtube.com and must overwrite earlier google.com ones.
    cookie_pairs = cookie_raw_str.split("; ")
    dedup_cookies = {}
    for item in cookie_pairs:
        if "=" in item:
            k, v = item.split("=", 1)
            dedup_cookies[k.strip()] = v.strip()

    # Ensure __Secure-3PAPISID is present
    if "__Secure-3PAPISID" not in dedup_cookies:
        for fallback_k in ["SAPISID", "__Secure-1PAPISID"]:
            if fallback_k in dedup_cookies:
                dedup_cookies["__Secure-3PAPISID"] = dedup_cookies[fallback_k]
                break

    clean_cookie_str = "; ".join(f"{k}={v}" for k, v in dedup_cookies.items())

    # Build auth dict with standard YouTube Music browser headers
    auth_dict = {}
    try:
        auth_dict.update(initialize_headers())
    except Exception:
        pass

    auth_dict["cookie"] = clean_cookie_str
    auth_dict["x-goog-authuser"] = headers_dict.get("x-goog-authuser", "0")
    auth_dict["origin"] = headers_dict.get("origin", "https://music.youtube.com")

    # Generate SAPISIDHASH authorization header
    try:
        sapisid = sapisid_from_cookie(clean_cookie_str)
        auth_dict["authorization"] = get_authorization(
            sapisid + " " + auth_dict["origin"]
        )
    except Exception as e:
        print(f"[NightWave] Warning: Could not generate authorization header: {e}")

    for k, v in headers_dict.items():
        if k not in auth_dict and k not in ("accept-encoding", "connection", "host", "content-length"):
            auth_dict[k] = v

    return auth_dict


def parse_track_item(item: dict) -> dict | None:
    """Standardize a track item from ytmusicapi into NightWave track schema."""
    try:
        video_id = item.get("videoId", "")
        if not video_id:
            return None

        title = item.get("title", "Unknown")
        artists = item.get("artists", [])
        artist = ", ".join(a.get("name", "") for a in artists) if artists else "Unknown Artist"
        album_data = item.get("album") or {}
        album = album_data.get("name", "") if isinstance(album_data, dict) else ""
        thumbnails = item.get("thumbnails", []) or item.get("thumbnail", [])
        thumbnail = _best_thumbnail(thumbnails)
        duration_str = item.get("duration", item.get("length", "0:00")) or "0:00"
        duration_secs = _parse_duration(duration_str)

        return {
            "id": video_id,
            "title": title,
            "artist": artist,
            "album": album,
            "thumbnail": thumbnail,
            "duration": duration_secs,
            "durationStr": duration_str,
        }
    except Exception:
        return None


async def _refresh_profile_in_background(ytm: YTMusic):
    """Fetches full account name, handle, liked count and playlists asynchronously without blocking the client."""
    try:
        user_info = {
            "name": "YouTube Music User",
            "handle": "",
            "photoUrl": "",
            "likedCount": 0,
            "playlistCount": 0,
        }

        async def _get_acc():
            try:
                return await asyncio.to_thread(ytm.get_account_info)
            except Exception:
                return None

        async def _get_liked_cnt():
            try:
                liked = await asyncio.to_thread(ytm.get_liked_songs, limit=1)
                return liked.get("trackCount", 0) or len(liked.get("tracks", []))
            except Exception:
                return 0

        async def _get_pl_cnt():
            try:
                pls = await asyncio.to_thread(ytm.get_library_playlists, limit=10)
                return len(pls)
            except Exception:
                return 0

        acc, liked_cnt, pl_cnt = await asyncio.gather(_get_acc(), _get_liked_cnt(), _get_pl_cnt())
        if acc:
            user_info["name"] = acc.get("accountName", "YouTube Music User")
            user_info["handle"] = acc.get("channelHandle", "")
            user_info["photoUrl"] = acc.get("accountPhotoUrl", "")
        user_info["likedCount"] = liked_cnt
        user_info["playlistCount"] = pl_cnt

        result = {
            "connected": True,
            "user": user_info,
            "message": "Connected to YouTube Music",
        }
        set_user_cache("user_status", result)
    except Exception as e:
        print(f"[NightWave] Background profile refresh notice: {e}")


@router.get("/user/status")
async def user_status():
    """Check if the user has connected their YouTube Music account, returning profile info."""
    ytm, is_auth = get_ytm()
    if not is_auth:
        return {"connected": False, "message": "Not connected to YouTube Music"}

    cached = get_user_cache("user_status")
    if cached and cached.get("user", {}).get("name") and cached.get("user", {}).get("name") != "YouTube Music User":
        return cached

    # Fetch live account info
    user_info = {
        "name": "YouTube Music User",
        "handle": "",
        "photoUrl": "",
        "likedCount": 0,
        "playlistCount": 0,
    }
    try:
        acc = await asyncio.to_thread(ytm.get_account_info)
        if acc:
            user_info["name"] = acc.get("accountName", "YouTube Music User")
            user_info["handle"] = acc.get("channelHandle", "")
            user_info["photoUrl"] = acc.get("accountPhotoUrl", "")
    except Exception as e:
        print(f"[NightWave] Account info fetch notice: {e}")

    result = {
        "connected": True,
        "user": user_info,
        "message": "Connected to YouTube Music",
    }
    set_user_cache("user_status", result)
    return result


@router.post("/user/connect")
async def connect_user(payload: dict = Body(...)):
    """
    Connect user account by pasting browser request headers or cookie copied from music.youtube.com.
    Accepts either raw headers block or just cookie string.
    """
    raw_input = payload.get("headers", "").strip() or payload.get("cookie", "").strip()
    if not raw_input:
        raise HTTPException(status_code=400, detail="Headers or cookie cannot be empty")

    try:
        auth_dict = _build_auth_dict(raw_input)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    print(f"[NightWave] Auth dict keys: {list(auth_dict.keys())}")
    print(f"[NightWave] Has authorization: {'authorization' in auth_dict}")
    print(f"[NightWave] Cookie (first 80): {auth_dict.get('cookie', '')[:80]}")

    try:
        test_client = YTMusic(auth_dict)
        print(f"[NightWave] Auth type: {test_client.auth_type}")

        # Probe library playlists or liked songs without hard failing on empty libraries
        probe_ok = False
        try:
            test_client.get_library_playlists(limit=1)
            probe_ok = True
            print("[NightWave] Library playlists probe: OK")
        except Exception as e1:
            print(f"[NightWave] Library playlists probe failed: {e1}")
            try:
                test_client.get_liked_songs(limit=1)
                probe_ok = True
                print("[NightWave] Liked songs probe: OK")
            except Exception as e2:
                print(f"[NightWave] Liked songs probe failed: {e2}")

        # Save to auth file
        with open(AUTH_FILE, "w", encoding="utf-8") as f:
            json.dump(auth_dict, f, indent=2)

        global _user_ytm
        _user_ytm = test_client
        clear_user_cache()

        return {
            "success": True,
            "message": "Successfully connected your YouTube Music account!",
            "probeOk": probe_ok,
        }
    except Exception as exc:
        import traceback
        traceback.print_exc()
        print(f"[NightWave Auth Error] Error: {exc}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to authenticate with YouTube Music. Error: {exc}",
        )


@router.post("/user/disconnect")
async def disconnect_user():
    """Disconnect user account and return to unauthorized public mode."""
    global _user_ytm
    _user_ytm = None
    clear_user_cache()
    if AUTH_FILE.exists():
        try:
            os.remove(AUTH_FILE)
        except Exception:
            pass
    return {"success": True, "message": "Disconnected from YouTube Music"}


@router.get("/user/home")
async def user_home(limit: int = 10):
    """
    Get user's personalized YouTube Music Home Feed shelves:
    'Mixed for you', 'Quick picks', 'Listen again', 'Similar to ...'
    """
    cache_key = f"home_{limit}"
    cached = get_user_cache(cache_key)
    if cached:
        return cached

    ytm, is_auth = get_ytm()
    try:
        home_shelves = await asyncio.to_thread(ytm.get_home, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch home recommendations: {exc}")

    shelves = []
    for shelf in home_shelves:
        title = shelf.get("title", "")
        contents = shelf.get("contents", [])
        parsed_tracks = []
        for item in contents:
            t = parse_track_item(item)
            if t:
                parsed_tracks.append(t)

        if parsed_tracks:
            shelves.append({
                "title": title,
                "tracks": parsed_tracks,
                "count": len(parsed_tracks),
            })

    result = {"shelves": shelves, "authenticated": is_auth}
    set_user_cache(cache_key, result)
    return result


@router.get("/user/liked")
async def user_liked(limit: int = 50):
    """Get the user's Liked Songs (Favorites) directly from YouTube Music."""
    cache_key = f"liked_{limit}"
    cached = get_user_cache(cache_key)
    if cached:
        return cached

    ytm, is_auth = get_ytm()
    if not is_auth:
        raise HTTPException(status_code=401, detail="Please connect your YouTube Music account first")

    try:
        data = await asyncio.to_thread(ytm.get_liked_songs, limit=limit)
        tracks = []
        for item in data.get("tracks", []):
            t = parse_track_item(item)
            if t:
                tracks.append(t)
        result = {"tracks": tracks, "count": len(tracks)}
        set_user_cache(cache_key, result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch liked songs: {exc}")


@router.get("/user/playlists")
async def user_playlists(limit: int = 25):
    """Get the user's library playlists from YouTube Music."""
    cache_key = f"playlists_{limit}"
    cached = get_user_cache(cache_key)
    if cached:
        return cached

    ytm, is_auth = get_ytm()
    if not is_auth:
        raise HTTPException(status_code=401, detail="Please connect your YouTube Music account first")

    try:
        playlists_raw = await asyncio.to_thread(ytm.get_library_playlists, limit=limit)
        playlists = []
        for pl in playlists_raw:
            pl_id = pl.get("playlistId", "")
            title = pl.get("title", "Untitled Playlist")
            count = pl.get("count", 0)
            thumbnails = pl.get("thumbnails", [])
            thumbnail = _best_thumbnail(thumbnails)
            playlists.append({
                "id": pl_id,
                "title": title,
                "count": count,
                "thumbnail": thumbnail,
            })
        result = {"playlists": playlists, "count": len(playlists)}
        set_user_cache(cache_key, result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch library playlists: {exc}")


@router.get("/user/playlist/{playlist_id}")
async def playlist_tracks(playlist_id: str, limit: int = 100):
    """Get tracks inside a specific playlist."""
    cache_key = f"playlist_{playlist_id}_{limit}"
    cached = get_user_cache(cache_key)
    if cached:
        return cached

    ytm, _ = get_ytm()
    try:
        data = await asyncio.to_thread(ytm.get_playlist, playlist_id, limit=limit)
        tracks = []
        for item in data.get("tracks", []):
            t = parse_track_item(item)
            if t:
                tracks.append(t)
        result = {
            "title": data.get("title", ""),
            "description": data.get("description", ""),
            "tracks": tracks,
            "count": len(tracks),
        }
        set_user_cache(cache_key, result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch playlist tracks: {exc}")


@router.get("/user/history")
async def user_history():
    """Get the user's real YouTube Music playback history."""
    cache_key = "history"
    cached = get_user_cache(cache_key)
    if cached:
        return cached

    ytm, is_auth = get_ytm()
    if not is_auth:
        raise HTTPException(status_code=401, detail="Please connect your YouTube Music account first")

    try:
        history_raw = await asyncio.to_thread(ytm.get_history)
        tracks = []
        for item in history_raw:
            t = parse_track_item(item)
            if t:
                tracks.append(t)
        result = {"tracks": tracks, "count": len(tracks)}
        set_user_cache(cache_key, result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch history: {exc}")


@router.get("/discover/moods")
async def discover_moods():
    """Get YouTube Music Moods & Genres categories."""
    cached = get_user_cache("discover_moods")
    if cached:
        return cached

    ytm, _ = get_ytm()
    try:
        raw = await asyncio.to_thread(ytm.get_mood_categories)
        categories = []
        for cat_name, items in (raw or {}).items():
            parsed_items = [
                {"title": it.get("title", ""), "params": it.get("params", "")}
                for it in (items or [])
                if it.get("title") and it.get("params")
            ]
            if parsed_items:
                categories.append({"category": cat_name, "items": parsed_items})
        result = {"categories": categories}
        set_user_cache("discover_moods", result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch mood categories: {exc}")


@router.get("/discover/mood/{params}")
async def discover_mood_playlists(params: str):
    """Get YouTube Music playlists for a given mood/genre params token."""
    cache_key = f"discover_mood_{params}"
    cached = get_user_cache(cache_key)
    if cached:
        return cached

    ytm, _ = get_ytm()
    try:
        raw = await asyncio.to_thread(ytm.get_mood_playlists, params)
        playlists = []
        for pl in (raw or []):
            pl_id = pl.get("playlistId", "")
            if not pl_id:
                continue
            playlists.append({
                "id": pl_id,
                "title": pl.get("title", "Playlist"),
                "description": pl.get("description", ""),
                "thumbnail": _best_thumbnail(pl.get("thumbnails", [])),
            })
        result = {"playlists": playlists}
        set_user_cache(cache_key, result)
        return result
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch mood playlists: {exc}")


@router.post("/user/like")
async def user_like_song(payload: dict = Body(...)):
    """Like or unlike a song on the user's YouTube Music account."""
    video_id = (payload.get("videoId") or "").strip()
    liked = bool(payload.get("liked", True))
    if not video_id:
        raise HTTPException(status_code=400, detail="videoId is required")

    ytm, is_auth = get_ytm()
    if not is_auth:
        return {"success": False, "message": "Not connected"}

    try:
        rating = "LIKE" if liked else "INDIFFERENT"
        await asyncio.to_thread(ytm.rate_song, video_id, rating)
        invalidate_user_cache_prefix("liked_")
        return {"success": True, "videoId": video_id, "liked": liked}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to update like status: {exc}")


@router.post("/user/history/add")
async def user_add_history(payload: dict = Body(...)):
    """Record a song play into the user's YouTube Music history."""
    video_id = (payload.get("videoId") or "").strip()
    if not video_id:
        return {"success": False}

    ytm, is_auth = get_ytm()
    if not is_auth:
        return {"success": False}

    try:
        song = await asyncio.to_thread(ytm.get_song, video_id)
        if song:
            await asyncio.to_thread(ytm.add_history_item, song)
            invalidate_user_cache_prefix("history")
        return {"success": True}
    except Exception as exc:
        print(f"[NightWave] History sync notice: {exc}")
        return {"success": False}


@router.post("/user/playlist/create")
async def user_create_playlist(payload: dict = Body(...)):
    """Create a new playlist on the user's YouTube Music account."""
    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()
    video_ids = payload.get("videoIds") or []
    if not title:
        raise HTTPException(status_code=400, detail="Playlist title is required")

    ytm, is_auth = get_ytm()
    if not is_auth:
        raise HTTPException(status_code=401, detail="Please connect your YouTube Music account first")

    try:
        pl_id = await asyncio.to_thread(
            ytm.create_playlist,
            title,
            description,
            "PRIVATE",
            video_ids if video_ids else None,
        )
        invalidate_user_cache_prefix("playlists_")
        return {"success": True, "playlistId": pl_id, "title": title}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to create playlist: {exc}")


@router.post("/user/playlist/add")
async def user_add_to_playlist(payload: dict = Body(...)):
    """Add tracks to an existing YouTube Music playlist."""
    playlist_id = (payload.get("playlistId") or "").strip()
    video_ids = payload.get("videoIds") or []
    if not playlist_id or not video_ids:
        raise HTTPException(status_code=400, detail="playlistId and videoIds are required")

    ytm, is_auth = get_ytm()
    if not is_auth:
        raise HTTPException(status_code=401, detail="Please connect your YouTube Music account first")

    try:
        await asyncio.to_thread(ytm.add_playlist_items, playlist_id, video_ids)
        invalidate_user_cache_prefix(f"playlist_{playlist_id}_")
        invalidate_user_cache_prefix("playlists_")
        return {"success": True, "playlistId": playlist_id}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to add to playlist: {exc}")
