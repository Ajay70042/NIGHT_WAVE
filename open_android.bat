@echo off
cd /d "%~dp0frontend"
echo [NightWave] Building frontend and syncing with Android project...
call npm.cmd run cap:sync
echo [NightWave] Opening project in Android Studio...
call npx.cmd cap open android
pause
