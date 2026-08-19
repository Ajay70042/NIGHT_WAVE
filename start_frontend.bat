@echo off
echo [NightWave] Starting frontend on http://localhost:5173 ...
cd frontend
node "%APPDATA%\..\Local\Programs\nodejs\node_modules\npm\bin\npm-cli.js" run dev 2>nul || node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev
