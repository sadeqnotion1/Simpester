#!/usr/bin/env python3
"""
Main entry point for the Fetch Wallpaper scraper.
"""

import argparse
import sys
from src.scraper import WallpaperScraper
from src.utils import setup_logging

def run_cli():
    parser = argparse.ArgumentParser(description="Scrape high-quality images from websites.")
    parser.add_argument("--site", type=str, default="margaretqualley", help="Site to scrape (default: margaretqualley)")
    parser.add_argument("--config", type=str, help="Path to custom config file")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    parser.add_argument("--gui", action="store_true", help="Launch graphical user interface")
    args = parser.parse_args()

    if args.gui:
        launch_gui()
    else:
        setup_logging(verbose=args.verbose)
        try:
            scraper = WallpaperScraper(site_name=args.site, config_path=args.config)
            scraper.run()
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)

def launch_gui():
    """Launch the graphical user interface."""
    try:
        from gui import main as gui_main
        gui_main()
    except ImportError as e:
        print(f"Failed to launch GUI: {e}")
        print("Make sure tkinter is available and gui.py exists.")
        sys.exit(1)

if __name__ == "__main__":
    run_cli()