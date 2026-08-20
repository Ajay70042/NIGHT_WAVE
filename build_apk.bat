@echo off
cd /d "%~dp0frontend"
echo ========================================================
echo [NightWave] Building Frontend Assets...
echo ========================================================
call npm.cmd run cap:sync
if %errorlevel% neq 0 (
    echo Error during frontend sync.
    pause
    exit /b 1
)

echo ========================================================
echo [NightWave] Compiling Native Android APK...
echo ========================================================
cd /d "%~dp0frontend\android"
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo Error during APK compilation.
    pause
    exit /b 1
)

copy /y "%~dp0frontend\android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0NightWave.apk"
echo ========================================================
echo [SUCCESS] APK built successfully!
echo Location: %~dp0NightWave.apk
echo ========================================================
pause
