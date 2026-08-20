"""
NightWave — FastAPI Backend
Serves /api/search, /api/stream, /api/lyrics
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes.search import router as search_router
from backend.routes.stream import router as stream_router
from backend.routes.lyrics import router as lyrics_router
from backend.routes.suggestions import router as suggestions_router

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


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "nightwave-api"}
