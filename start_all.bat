@echo off
echo [NightWave] Starting Backend and Frontend services...
start "NightWave Backend (Port 8000)" cmd /k "%~dp0start_backend.bat"
timeout /t 2 /nobreak >nul
start "NightWave Frontend (Port 5173)" cmd /k "%~dp0start_frontend.bat"
