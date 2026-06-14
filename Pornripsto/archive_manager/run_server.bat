@echo off
title CineArchive Manager Server
cd /d "%~dp0"

echo ===================================================
echo   CineArchive - Localhost Video Database Manager
echo ===================================================
echo.

if not exist node_modules (
    echo [INFO] Installing required dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please ensure Node.js is installed correctly.
        pause
        exit /b %errorlevel%
    )
)

echo [INFO] Starting the server...
start "" "http://localhost:3000"
call npm start
pause
