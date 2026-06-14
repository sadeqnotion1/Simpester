@echo off
setlocal
title Fetch-WP GUI - Simpester
cd /d "G:\SimpCounty\Fetch-WP\simpester"
echo Starting Fetch-WP GUI (Simpester) from: %cd%
echo.
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
echo.
call npm run dev %*
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Process exited with code %errorlevel%.
)
echo.
pause
