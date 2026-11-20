@echo off
REM One-click launcher. Installs packages ONLY the first time (if missing), then opens backend + frontend.
cd /d "%~dp0"

if not exist "backend\venv\Scripts\python.exe" (
  echo First run: installing backend packages, please wait...
  python -m venv backend\venv
  backend\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
  if errorlevel 1 goto fail
)

if not exist "frontend\node_modules" (
  echo First run: installing frontend packages, please wait...
  pushd frontend
  call npm install --legacy-peer-deps
  if errorlevel 1 (
    popd
    goto fail
  )
  popd
)

echo Launching EcoForge...
start "" "%~dp0run_backend.bat"
start "" "%~dp0run_frontend.bat"
echo.
echo Two windows opened (Backend + Frontend).
echo Wait ~30s for "Compiled successfully!" then open:  http://localhost:3000
echo To stop the app, close both windows.
echo.
pause
exit /b 0

:fail
echo.
echo Install FAILED. Check that Python 3.11+ and Node.js 18+ are installed and on PATH, and that you have internet.
pause
exit /b 1
