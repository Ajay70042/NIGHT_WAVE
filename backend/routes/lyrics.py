"""
GET /api/lyrics?title={title}&artist={artist}&duration={seconds}&videoId={id}

Multi-Source Synced Lyrics Engine:
1. Intelligent Title & Artist Normalizer (strips "(Official Video)", "feat. X", "4K", etc.)
2. Provider 1: LRCLIB (Direct exact get + multi-query search with duration proximity)
3. Provider 2: NetEase Cloud Music (Massive database of synchronized LRC lyrics)
4. Provider 3: YouTube Captions / Subtitles (Exact millisecond manual & auto subtitles via yt-dlp)
5. Provider 4: Lyrics.ovh (Plain text database fallback)
6. Intelligent Auto-Sync Engine: If only plain text is found, automatically assigns weighted timestamps
   so that 100% of songs with lyrics become time-synchronized and auto-scroll with the music!
"""
import re
import asyncio
import httpx
from fastapi import APIRouter, Query
try:
    from backend.cache import get_lyrics, set_lyrics
except ImportError:
    from cache import get_lyrics, set_lyrics

router = APIRouter()
LRCLIB_BASE = "https://lrclib.net/api"
NETEASE_SEARCH_URL = "https://music.163.com/api/cloudsearch/pc"
NETEASE_LYRIC_URL = "https://music.163.com/api/song/lyric"
LYRICS_OVH_BASE = "https://api.lyrics.ovh/v1"

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Referer": "https://music.163.com/",
}


def _clean_variations(title: str, artist: str = "") -> list[tuple[str, str]]:
    """
    Cleans noisy YouTube titles and generates best-candidate (title, artist) search pairs.
    E.g. 'Starboy (Official Music Video) ft. Daft Punk' -> 'Starboy', 'The Weeknd'
    """
    # Remove bracketed noise
    t_clean = re.sub(
        r"[\(\[\{].*?(official|video|audio|lyrics|visualizer|remaster|explicit|hd|4k|live|feat|ft|prod|version|edit).*?[\)\]\}]",
        "",
        title,
        flags=re.IGNORECASE,
    )
    # Remove trailing feat.
    t_clean = re.sub(r"\s+(feat\.?|ft\.?)\s+.*$", "", t_clean, flags=re.IGNORECASE)
    # Remove trailing track numbering / hyphens
    t_clean = re.sub(r"[-–—|].*$", "", t_clean).strip()
    t_clean = re.sub(r"\s+", " ", t_clean).strip()

    # Clean artist
    a_clean = re.sub(r"\s+(feat\.?|ft\.?|,|&|x|\+).*$", "", artist, flags=re.IGNORECASE).strip()
    a_clean = re.sub(r"\s+", " ", a_clean).strip()

    variations = []
    if t_clean and a_clean:
        variations.append((t_clean, a_clean))
    if t_clean and artist and artist != a_clean:
        variations.append((t_clean, artist))
    if title != t_clean and a_clean:
        variations.append((title, a_clean))
    if t_clean:
        variations.append((t_clean, ""))
    if title not in [v[0] for v in variations]:
        variations.append((title, artist))

    return variations


def _parse_lrc(lrc_text: str) -> list[dict]:
    """Parse standard & enhanced LRC format into [{time: float, text: str, words?: list}]."""
    lines = []
    time_tag_pattern = re.compile(r"\[(\d{1,3}):(\d{2})(?:[\.:](\d{2,3}))?\]")
    word_tag_pattern = re.compile(r"<(\d{1,3}):(\d{2})(?:[\.:](\d{2,3}))?>")
    
    for raw in lrc_text.splitlines():
        raw = raw.strip()
        if not raw or re.match(r"^\[[a-zA-Z]{2,6}:.*\]$", raw):
            continue

        timestamps = list(time_tag_pattern.finditer(raw))
        if not timestamps:
            continue

        content = time_tag_pattern.sub("", raw).strip()
        if not content:
            continue

        # Check for enhanced word timestamps: <mm:ss.xx>word
        word_matches = list(word_tag_pattern.finditer(content))
        words_list = []
        if word_matches:
            for idx, wm in enumerate(word_matches):
                w_min, w_sec, w_cs = wm.groups()
                w_cs = w_cs or "0"
                cs_val = int(w_cs) / (100 if len(w_cs) <= 2 else 1000)
                w_time = int(w_min) * 60 + int(w_sec) + cs_val
                start_pos = wm.end()
                end_pos = word_matches[idx + 1].start() if idx + 1 < len(word_matches) else len(content)
                w_text = content[start_pos:end_pos].strip()
                w_text = re.sub(r"[♪♫#\r]+", "", w_text).strip()
                if w_text:
                    words_list.append({"text": w_text, "time": round(w_time, 2)})
            
            # Calculate word durations
            for i, w in enumerate(words_list):
                if i + 1 < len(words_list):
                    w["duration"] = round(max(0.1, words_list[i + 1]["time"] - w["time"]), 2)
                else:
                    w["duration"] = 0.5

        clean_text = word_tag_pattern.sub("", content)
        clean_text = re.sub(r"[♪♫#\r]+", "", clean_text).strip()
        clean_text = re.sub(r"\s+", " ", clean_text)
        if not clean_text:
            continue

        for m in timestamps:
            minutes, seconds, centiseconds = m.groups()
            centiseconds = centiseconds or "0"
            cs_val = int(centiseconds) / (100 if len(centiseconds) <= 2 else 1000)
            time_secs = int(minutes) * 60 + int(seconds) + cs_val
            item = {"time": round(time_secs, 2), "text": clean_text}
            if words_list:
                item["words"] = words_list
            lines.append(item)

    return sorted(lines, key=lambda x: x["time"])


def _auto_sync_plain_lyrics(plain_text: str, duration: float = 180.0) -> list[dict]:
    """
    Intelligently generates realistic time-synchronized lines for plain text lyrics
    using syllable/character weight pacing across the track's vocal duration.
    """
    raw_lines = [l.strip() for l in plain_text.splitlines() if l.strip()]
    lines = []
    for l in raw_lines:
        # Ignore [Chorus], (Verse 1), etc.
        if re.match(r"^(\[|\()[A-Za-z0-9\s:_-]+(\]|\))$", l):
            continue
        cleaned = re.sub(r"[♪♫#\r]+", "", l).strip()
        if cleaned:
            lines.append(cleaned)
    if not lines:
        return []

    dur = float(duration) if duration > 30 else len(lines) * 3.8
    start_t = min(15.0, max(4.0, dur * 0.06))
    end_t = max(start_t + 10.0, dur * 0.94)
    total_active_time = end_t - start_t

    # Calculate weight per line based on character length and word count
    weights = []
    for l in lines:
        w = max(1.5, len(l) * 0.1 + len(l.split()) * 0.4)
        weights.append(w)

    sum_w = sum(weights)
    curr = start_t
    result = []
    for l, w in zip(lines, weights):
        result.append({"time": round(curr, 2), "text": l})
        curr += (w / sum_w) * total_active_time

    return result


async def _fetch_lrclib(client: httpx.AsyncClient, variations: list[tuple[str, str]], duration: int) -> dict | None:
    """Query LRCLIB with candidate variations."""
    for t, a in variations:
        try:
            # 1. Exact get
            params = {"track_name": t}
            if a:
                params["artist_name"] = a
            if duration > 0:
                params["duration"] = duration

            r = await client.get(f"{LRCLIB_BASE}/get", params=params, timeout=5)
            if r.status_code == 200:
                data = r.json()
                synced_lrc = data.get("syncedLyrics") or ""
                if synced_lrc:
                    parsed = _parse_lrc(synced_lrc)
                    if parsed:
                        return {"synced": True, "lines": parsed, "provider": "lrclib"}
                plain = data.get("plainLyrics") or ""
                if plain:
                    return {"synced": False, "plain": plain, "provider": "lrclib"}

            # 2. Search fallback
            q = f"{t} {a}".strip()
            r_search = await client.get(f"{LRCLIB_BASE}/search", params={"q": q}, timeout=5)
            if r_search.status_code == 200:
                results = r_search.json()
                if isinstance(results, list) and results:
                    # Pick closest duration or first
                    best = results[0]
                    if duration > 0:
                        best = min(results[:5], key=lambda x: abs((x.get("duration") or 0) - duration))
                    synced_lrc = best.get("syncedLyrics") or ""
                    if synced_lrc:
                        parsed = _parse_lrc(synced_lrc)
                        if parsed:
                            return {"synced": True, "lines": parsed, "provider": "lrclib"}
                    plain = best.get("plainLyrics") or ""
                    if plain:
                        return {"synced": False, "plain": plain, "provider": "lrclib"}
        except Exception:
            continue
    return None


async def _fetch_netease(client: httpx.AsyncClient, variations: list[tuple[str, str]]) -> dict | None:
    """Query NetEase Cloud Music for synchronized LRC lyrics."""
    for t, a in variations:
        try:
            query = f"{t} {a}".strip()
            r = await client.post(
                NETEASE_SEARCH_URL,
                data={"s": query, "type": 1, "limit": 3, "offset": 0},
                headers=DEFAULT_HEADERS,
                timeout=5,
            )
            if r.status_code == 200:
                data = r.json()
                songs = data.get("result", {}).get("songs", [])
                if songs:
                    song_id = songs[0].get("id")
                    if song_id:
                        r_lyric = await client.get(
                            NETEASE_LYRIC_URL,
                            params={"os": "pc", "id": song_id, "lv": -1, "kv": -1, "tv": -1},
                            headers=DEFAULT_HEADERS,
                            timeout=5,
                        )
                        if r_lyric.status_code == 200:
                            lyric_data = r_lyric.json()
                            lrc_str = lyric_data.get("lrc", {}).get("lyric", "")
                            if lrc_str:
                                parsed = _parse_lrc(lrc_str)
                                if parsed:
                                    return {"synced": True, "lines": parsed, "provider": "netease"}
        except Exception:
            continue
    return None


def _extract_youtube_captions_sync(video_id: str) -> list[dict]:
    """Extract YouTube captions/subtitles via yt-dlp with millisecond per-word timestamps."""
    if not video_id:
        return []
    import yt_dlp
    ydl_opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "quiet": True,
        "no_warnings": True,
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            subs = info.get("subtitles") or {}
            auto_subs = info.get("automatic_captions") or {}
            all_subs = {**subs, **auto_subs}
            if not all_subs:
                return []

            # Prioritize standard languages
            pref_langs = ["en", "en-US", "en-orig", "en-GB", "es", "hi", "ko", "ja", "fr", "de"]
            chosen_lang = None
            for pl in pref_langs:
                for k in all_subs.keys():
                    if k.lower() == pl or k.lower().startswith(pl + "-"):
                        chosen_lang = k
                        break
                if chosen_lang:
                    break
            if not chosen_lang:
                chosen_lang = list(all_subs.keys())[0]

            formats = all_subs.get(chosen_lang, [])
            json3_fmt = next((f for f in formats if f.get("ext") == "json3"), None)
            if not json3_fmt:
                return []

            with httpx.Client(timeout=8) as sync_client:
                r = sync_client.get(json3_fmt["url"])
                if r.status_code != 200:
                    return []
                data = r.json()
                events = data.get("events", [])
                lines = []

                for ev in events:
                    t_start_ms = ev.get("tStartMs", 0)
                    d_dur_ms = ev.get("dDurationMs", 0)
                    segs = ev.get("segs", [])
                    if not segs:
                        continue

                    raw_text = "".join(s.get("utf8", "") for s in segs).strip()
                    clean_line = re.sub(r"[♪♫\r\n]+", " ", raw_text).strip()
                    clean_line = re.sub(r"\s+", " ", clean_line)

                    # Filter out metadata lines or noise
                    if not clean_line or clean_line == "\n" or re.match(r"^\[.*?\]$", clean_line):
                        continue

                    line_start_sec = round(t_start_ms / 1000.0, 3)
                    line_dur_sec = round(d_dur_ms / 1000.0, 3)

                    # Extract per-word millisecond offsets
                    words = []
                    for seg in segs:
                        w_raw = seg.get("utf8", "")
                        w_clean = re.sub(r"[♪♫\r\n]+", "", w_raw).strip()
                        if not w_clean:
                            continue
                        w_offset_ms = seg.get("tOffsetMs", 0)
                        w_time = round((t_start_ms + w_offset_ms) / 1000.0, 3)
                        words.append({"text": w_clean, "time": w_time})

                    # Calculate per-word duration
                    for i, w in enumerate(words):
                        if i + 1 < len(words):
                            w["duration"] = round(max(0.08, words[i + 1]["time"] - w["time"]), 3)
                        else:
                            w["duration"] = round(max(0.15, (line_start_sec + line_dur_sec) - w["time"]), 3)

                    item = {
                        "time": line_start_sec,
                        "duration": line_dur_sec,
                        "text": clean_line,
                    }
                    if words:
                        item["words"] = words
                    lines.append(item)

                if lines and len(lines) >= 3:
                    return sorted(lines, key=lambda x: x["time"])
    except Exception:
        pass
    return []


async def _fetch_lyrics_ovh(client: httpx.AsyncClient, variations: list[tuple[str, str]]) -> str | None:
    """Fetch plain text lyrics from Lyrics.ovh."""
    for t, a in variations:
        if not a:
            continue
        try:
            r = await client.get(f"{LYRICS_OVH_BASE}/{a}/{t}", timeout=4)
            if r.status_code == 200:
                lyrics_text = r.json().get("lyrics", "")
                if lyrics_text and len(lyrics_text.strip()) > 30:
                    return lyrics_text
        except Exception:
            continue
    return None


@router.get("/lyrics")
async def lyrics(
    title: str = Query(...),
    artist: str = Query(""),
    duration: int = Query(0, ge=0),
    videoId: str = Query("", description="Optional YouTube video ID for subtitle fallback"),
):
    cache_key = f"{title.lower().strip()}::{artist.lower().strip()}::{duration}::{videoId}"
    cached = get_lyrics(cache_key)
    if cached:
        return cached

    variations = _clean_variations(title, artist)

    async with httpx.AsyncClient(timeout=8) as client:
        # 1. Try LRCLIB for complete studio synchronized LRC
        lrclib_res = await _fetch_lrclib(client, variations, duration)
        if lrclib_res and lrclib_res.get("synced") and lrclib_res.get("lines"):
            set_lyrics(cache_key, lrclib_res)
            return lrclib_res

        # 2. Try NetEase Cloud Music for complete studio synchronized LRC
        netease_res = await _fetch_netease(client, variations)
        if netease_res and netease_res.get("synced") and netease_res.get("lines"):
            set_lyrics(cache_key, netease_res)
            return netease_res

        # 3. If videoId is provided, try YouTube word-aligned captions/subtitles
        if videoId:
            try:
                loop = asyncio.get_event_loop()
                yt_lines = await loop.run_in_executor(None, _extract_youtube_captions_sync, videoId)
                if yt_lines and len(yt_lines) >= 3:
                    res = {"synced": True, "lines": yt_lines, "provider": "youtube_word_sync"}
                    set_lyrics(cache_key, res)
                    return res
            except Exception:
                pass

        # 4. If LRCLIB gave plain text, auto-sync it with intelligent timestamps
        if lrclib_res and lrclib_res.get("plain"):
            synced_lines = _auto_sync_plain_lyrics(lrclib_res["plain"], duration)
            if synced_lines:
                res = {"synced": True, "lines": synced_lines, "provider": "lrclib_autosync"}
                set_lyrics(cache_key, res)
                return res

        # 5. Try Lyrics.ovh and auto-sync
        plain_ovh = await _fetch_lyrics_ovh(client, variations)
        if plain_ovh:
            synced_lines = _auto_sync_plain_lyrics(plain_ovh, duration)
            if synced_lines:
                res = {"synced": True, "lines": synced_lines, "provider": "lyricsovh_autosync"}
                set_lyrics(cache_key, res)
                return res

    # Fallback if no lyrics found anywhere
    res = {"synced": False, "plain": ""}
    set_lyrics(cache_key, res)
    return res

