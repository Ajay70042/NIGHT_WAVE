@echo off
echo [NightWave] Starting frontend on http://localhost:5173 ...
cd /d "%~dp0frontend"
call npm.cmd run dev
if %errorlevel% neq 0 (
    npm run dev
)
pause
