@echo off
echo [NightWave] Installing backend dependencies...
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo ERROR: pip install failed. Make sure Python 3.11+ is installed.
    pause
    exit /b 1
)
echo [NightWave] Starting FastAPI backend on http://localhost:8000 ...
python -m uvicorn backend.main:app --reload --port 8000
