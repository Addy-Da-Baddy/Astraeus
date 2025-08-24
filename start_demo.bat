@echo off
echo 🚀 Starting NovaGen Orbital Collision Risk Prediction System
echo ========================================================

echo.
echo Activating Python environment...
call .venv\Scripts\activate.bat

echo.
echo Starting Flask web server...
echo Dashboard will be available at:
echo   - Main Dashboard: http://localhost:5000
echo   - Advanced Dashboard: http://localhost:5000/dashboard
echo.
echo Press Ctrl+C to stop the server
echo.

python app.py
