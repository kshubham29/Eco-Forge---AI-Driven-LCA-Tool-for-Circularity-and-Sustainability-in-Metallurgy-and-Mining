@echo off
echo Setting up LCA Recyclability Prediction Backend...
echo.

cd /d "%~dp0"

echo Checking if Python is installed...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.8+ and try again
    pause
    exit /b 1
)

echo Python found. Installing backend dependencies...
pip install -r requirements.txt

echo.
echo Creating test ML models for recyclability prediction...
python create_test_models.py

echo.
echo Testing the recyclability prediction functionality...
python test_recyclability.py

echo.
echo Starting the backend server...
echo The server will run on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.
python start_server.py