import yt_dlp, httpx, asyncio, json

opts = {
    'quiet': True,
    'no_warnings': True,
    'format': 'bestaudio',
    'noplaylist': True,
    'extractor_args': {'youtube': {'player_client': ['tv_embedded']}},
}
with yt_dlp.YoutubeDL(opts) as ydl:
    info = ydl.extract_info('https://www.youtube.com/watch?v=CxKWTzr-k6s', download=False)

fmts = [f for f in info.get('formats', []) if f.get('acodec') != 'none' and f.get('vcodec') == 'none']
print("Available audio formats:")
for fmt in fmts:
    print(f"  {fmt.get('format_id')} ext={fmt.get('ext')} abr={fmt.get('abr')} proto={fmt.get('protocol')}")

async def test_all():
    async with httpx.AsyncClient(follow_redirects=True, timeout=10) as c:
        for fmt in fmts:
            try:
                r = await c.get(fmt['url'], headers=fmt.get('http_headers', {}))
                ct = r.headers.get('content-type', '?')[:40]
                print(f"  {fmt['format_id']} {fmt['ext']}: HTTP {r.status_code} ct={ct}")
            except Exception as e:
                print(f"  {fmt['format_id']} {fmt['ext']}: ERROR {e}")

asyncio.run(test_all())
