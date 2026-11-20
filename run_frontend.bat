@echo off
title LCA Frontend
cd /d "%~dp0frontend"
set BROWSER=none
echo Starting FRONTEND on http://localhost:3000  (Ctrl+C to stop)
echo Wait for "Compiled successfully!" then open http://localhost:3000
echo.
call npm start
echo.
echo Frontend stopped. Press any key to close.
pause >nul
