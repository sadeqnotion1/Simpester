@echo off
REM Simpester - Elite Control launcher
setlocal
title Simpester - Elite Control
cd /d "%~dp0"

echo ============================================================
echo   Simpester - Elite Control
echo ============================================================
echo.

REM First run: install dependencies (needs internet once).
if not exist ".deps_ok" (
    echo [SETUP] Installing dependencies...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Dependency install failed. Check your Python/pip and internet connection.
        pause
        exit /b 1
    )
    echo ok> .deps_ok
)

python main.py %*

pause
