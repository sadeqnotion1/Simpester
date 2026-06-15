"""Adapter for the original Fetch Wallpaper scraper (src/scraper.py).

We do NOT fork the scraper logic — we drive the existing WallpaperScraper class,
override its config from the GUI form, capture its `logging` output into the
job log, and poll its live counters so the UI can show progress.
"""

import logging
import threading
import time


class _JobLogHandler(logging.Handler):
    """Pipe the scraper's logging records into the job log."""

    def __init__(self, job):
        super().__init__()
        self.job = job

    def emit(self, record):
        if record.levelno >= logging.ERROR:
            level = "error"
        elif record.levelno >= logging.WARNING:
            level = "warn"
        else:
            level = "info"
        try:
            self.job.add_log(self.format(record), level)
        except Exception:
            pass


def _as(value, cast, default=None):
    if value in (None, ""):
        return default
    try:
        return cast(value)
    except (TypeError, ValueError):
        return default


def run_wallpaper(job, params):
    from src.scraper import WallpaperScraper

    requested_site = (params.get("site") or "").strip()
    base_url = (params.get("base_url") or "").strip()
    if base_url and (not requested_site or requested_site == "margaretqualley"):
        site = "custom"
    else:
        site = requested_site or "margaretqualley"

    if base_url and site == "custom":
        job.add_log(f"Custom URL mode → scraping {base_url} with a neutral profile.")
    job.add_log(f"Initializing Fetch Wallpaper for site '{site}'…")
    job.set_stats(site=site, pages=0, images_found=0, status_text="starting")

    scraper = WallpaperScraper(site_name=site, config_path=params.get("config") or None)
    job.bind_stopper(scraper.stop)

    general = scraper.config.setdefault("general", {})
    overrides = {
        "min_width": ("min_width", int),
        "min_height": ("min_height", int),
        "max_pages": ("max_pages", int),
        "crawl_depth": ("crawl_depth", int),
        "max_workers": ("max_workers", int),
        "timeout": ("timeout", int),
        "rate_limit": ("rate_limit", float),
    }
    for form_key, (cfg_key, cast) in overrides.items():
        val = _as(params.get(form_key), cast)
        if val is not None:
            general[cfg_key] = val
    if params.get("download_dir"):
        general["download_dir"] = params["download_dir"]
    if base_url:
        scraper.config.setdefault("site", {})["base_url"] = base_url

    job.add_log(
        "Config → "
        f"min {general.get('min_width')}x{general.get('min_height')}, "
        f"max_pages {general.get('max_pages')}, depth {general.get('crawl_depth')}, "
        f"workers {general.get('max_workers')}, dir {general.get('download_dir')}"
        + (f", base_url {base_url}" if base_url else "")
    )

    handler = _JobLogHandler(job)
    handler.setFormatter(logging.Formatter("%(message)s"))
    handler.setLevel(logging.INFO)
    src_logger = logging.getLogger("src")
    src_logger.setLevel(logging.INFO)
    src_logger.addHandler(handler)

    stop_poll = threading.Event()

    def poll():
        while not stop_poll.is_set():
            job.set_stats(
                pages=len(getattr(scraper, "visited_urls", []) or []),
                images_found=len(getattr(scraper, "image_urls", []) or []),
                status_text="crawling",
            )
            time.sleep(0.7)

    poller = threading.Thread(target=poll, daemon=True)
    poller.start()

    try:
        scraper.run()
        job.set_stats(
            pages=len(getattr(scraper, "visited_urls", []) or []),
            images_found=len(getattr(scraper, "image_urls", []) or []),
            status_text="stopped" if job.stop_requested else "finished",
        )
        if job.stop_requested:
            job.add_log("Fetch Wallpaper stopped by user.", "warn")
        else:
            job.add_log("Fetch Wallpaper finished.", "success")
    finally:
        stop_poll.set()
        src_logger.removeHandler(handler)
