import sys
from pathlib import Path

# Ensure both repo root and backend directory are in sys.path for Render / local flexibility
_CUR_DIR = Path(__file__).resolve().parent
_ROOT_DIR = _CUR_DIR.parent
if str(_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(_ROOT_DIR))
if str(_CUR_DIR) not in sys.path:
    sys.path.insert(0, str(_CUR_DIR))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.routes.search import router as search_router
    from backend.routes.stream import router as stream_router
    from backend.routes.lyrics import router as lyrics_router
    from backend.routes.suggestions import router as suggestions_router
except ImportError:
    from routes.search import router as search_router
    from routes.stream import router as stream_router
    from routes.lyrics import router as lyrics_router
    from routes.suggestions import router as suggestions_router

app = FastAPI(
    title="NightWave API",
    description="Audio search & stream resolver for NightWave music player",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router, prefix="/api")
app.include_router(stream_router, prefix="/api")
app.include_router(lyrics_router, prefix="/api")
app.include_router(suggestions_router, prefix="/api")

@app.get("/")
@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "nightwave-api"}
