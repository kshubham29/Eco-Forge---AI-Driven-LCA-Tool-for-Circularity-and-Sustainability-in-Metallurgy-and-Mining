@echo off
title LCA Backend
cd /d "%~dp0backend"
echo Starting BACKEND on http://localhost:8000  (Ctrl+C to stop)
echo.
venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
echo.
echo Backend stopped. Press any key to close.
pause >nul
