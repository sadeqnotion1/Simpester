@echo off
title Fetch Wallpaper Scraper GUI
echo ==================================================
echo         FETCH WALLPAPER SCRAPER GUI Launcher
echo ==================================================
echo.
echo Launching GUI...
python main.py --gui
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start the application.
    echo Please make sure Python is installed and added to your PATH, 
    echo and that all dependencies in requirements.txt are installed.
    echo.
    pause
)
