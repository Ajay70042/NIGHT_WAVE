@echo off
echo [NightWave] Generating public mobile testing link via localhost.run ...
echo Make sure your frontend and backend are running first!
echo.
ssh -o StrictHostKeyChecking=no -R 80:localhost:5173 nokey@localhost.run
pause
