@echo off
title Stop Pujor Parikrama Server
echo ===================================================
echo     🛑 STOPPING PUJOR PARIKRAMA SERVER (PORT 8080)
echo ===================================================
echo.

set FOUND=0

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
    echo [INFO] Terminating server process PID: %%a...
    taskkill /F /PID %%a >nul 2>&1
    set FOUND=1
)

if %FOUND%==0 (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo.
echo [SUCCESS] Local server on port 8080 has been completely stopped!
echo.
ping -n 3 127.0.0.1 >nul
