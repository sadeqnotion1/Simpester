#!/usr/bin/env python3
"""
Simpester — unified entry point.

Default (no args / double-clicked .bat):  launches the Elite Control GUI
  (Flask + pywebview control center that hosts every tool as a module).

CLI mode (backwards compatible with the original Fetch Wallpaper tool):
  python main.py --cli --site margaretqualley
  python main.py --cli --config configs/sites/foo.yaml --verbose
"""

import argparse
import sys


def run_cli(args):
    """Original Fetch Wallpaper command-line scraper."""
    from src.scraper import WallpaperScraper
    from src.utils import setup_logging

    setup_logging(verbose=args.verbose)
    try:
        scraper = WallpaperScraper(site_name=args.site, config_path=args.config)
        scraper.run()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Simpester — Elite Control. Launches the GUI by default."
    )
    parser.add_argument("--cli", action="store_true",
                        help="Run the original Fetch Wallpaper command-line scraper instead of the GUI.")
    parser.add_argument("--site", type=str, default="margaretqualley",
                        help="(CLI) Site to scrape (default: margaretqualley)")
    parser.add_argument("--config", type=str, help="(CLI) Path to a custom config file")
    parser.add_argument("--verbose", action="store_true", help="(CLI) Enable verbose logging")
    parser.add_argument("--no-window", action="store_true",
                        help="(GUI) Start the server only and open it in your default browser.")
    parser.add_argument("--port", type=int, default=0, help="(GUI) Force a specific port.")
    args = parser.parse_args()

    # --site/--config imply CLI even without --cli, to preserve old muscle memory.
    if args.cli or args.config or (args.site and args.site != "margaretqualley"):
        run_cli(args)
        return

    # Default: launch the Elite Control GUI.
    from app import launch
    launch(open_window=not args.no_window, forced_port=args.port or None)


if __name__ == "__main__":
    main()
