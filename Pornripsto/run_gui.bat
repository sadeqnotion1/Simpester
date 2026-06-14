@echo off
title PornRips Bulk Downloader Launcher
echo Starting GUI Launcher...

where pythonw >nul 2>nul
if %errorlevel% equ 0 (
    start pythonw pornrips_bulk_downloader_gui.py
    exit
)

where python >nul 2>nul
if %errorlevel% equ 0 (
    python pornrips_bulk_downloader_gui.py
    if %errorlevel% neq 0 pause
    exit
)

where py >nul 2>nul
if %errorlevel% equ 0 (
    py pornrips_bulk_downloader_gui.py
    if %errorlevel% neq 0 pause
    exit
)

echo.
echo ======================================================================
echo ERROR: Python is not installed or not added to your system PATH.
echo ======================================================================
echo.
echo Please install Python 3 and check "Add Python to PATH" during installation.
echo.
pause
