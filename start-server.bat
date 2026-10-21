@echo off
title Pujor Parikrama - Localhost Server
echo ===================================================
echo     🛕 PUJOR PARIKRAMA 2026 - LOCAL SERVER
echo ===================================================
echo.

:: 1. Clean up any existing process on port 8080
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    echo [INFO] Freeing occupied port 8080 (PID: %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: 2. Set directory to current script location
cd /d "%~dp0"

echo [OK] Starting local server at: http://localhost:8080
echo [INFO] Press Ctrl+C anytime to stop the server, or double-click stop-server.bat
echo.

:: 3. Launch browser after 2s background delay
start "" cmd /c "ping -n 3 127.0.0.1 >nul && start http://localhost:8080/"

:: 4. Start Python server
python -m http.server 8080 --bind 127.0.0.1

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Python failed. Trying Node.js npx...
    npx -y serve -p 8080
)

pause
