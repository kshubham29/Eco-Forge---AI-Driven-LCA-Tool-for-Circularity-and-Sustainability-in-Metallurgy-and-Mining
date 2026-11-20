@echo off
REM One-time setup after unzipping: creates the Python venv and installs the frontend packages.
REM Needs Python 3.11+ and Node.js 18+ installed. Takes about 5-10 minutes (internet needed).
cd /d "%~dp0"
echo === 1/2 Backend: creating venv and installing Python packages ===
cd backend
if not exist venv (
  python -m venv venv
)
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo Backend install FAILED. Check that Python is installed and on PATH.
  pause
  exit /b 1
)
cd ..
echo.
echo === 2/2 Frontend: installing npm packages ===
cd frontend
call npm install --legacy-peer-deps
if errorlevel 1 (
  echo.
  echo Frontend install FAILED. Check that Node.js is installed.
  pause
  exit /b 1
)
cd ..
echo.
echo Setup done. Now double-click START_APP.bat, or in VS Code run the task "Start App (Backend + Frontend)".
pause
