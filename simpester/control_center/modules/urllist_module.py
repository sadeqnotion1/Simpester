"""Adapter for the Fetch Wallpaper direct URL-list downloader (src/direct_download.py).

Downloads a flat list of direct image URLs (one per line), resolving jpg6.su
oembed pages to full-size images and skipping thumbnails by dimension. We drive
the existing download_url_list() unchanged, pipe its logging into the job log,
and poll the output folder for a live count.
"""

import logging
import os
import tempfile
import threading
import time

class _JobLogHandler(logging.Handler):
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

def _as_int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def _as_float(value, default):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default

def run_urllist(job, params):
    from src.direct_download import download_url_list

    download_dir = (params.get("download_dir") or "").strip() \
        or os.path.join(os.getcwd(), "downloads", "url_list")
    timeout = _as_int(params.get("timeout"), 30)
    rate_limit = _as_float(params.get("rate_limit"), 1.0)
    min_width = _as_int(params.get("min_width"), 800)
    min_height = _as_int(params.get("min_height"), 600)

    pasted = (params.get("urls") or "").strip()
    file_path = (params.get("file_path") or "").strip()
    temp_path = None
    if pasted:
        fd, temp_path = tempfile.mkstemp(prefix="simpester_urls_", suffix=".txt")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(pasted)
        file_path = temp_path
    if not file_path:
        raise ValueError("Provide URLs (paste a list) or a file path.")
    if not os.path.exists(file_path):
        raise ValueError(f"URL list file not found: {file_path}")

    os.makedirs(download_dir, exist_ok=True)
    try:
        baseline = len([f for f in os.listdir(download_dir)
                        if os.path.isfile(os.path.join(download_dir, f))])
    except OSError:
        baseline = 0

    job.set_stats(downloaded=0, status_text="starting")
    job.add_log("Output → " + download_dir)
    job.add_log(f"Filter: min {min_width}x{min_height}px · timeout {timeout}s · rate {rate_limit}s")

    handler = _JobLogHandler(job)
    handler.setFormatter(logging.Formatter("%(message)s"))
    handler.setLevel(logging.INFO)
    src_logger = logging.getLogger("src")
    src_logger.setLevel(logging.INFO)
    src_logger.addHandler(handler)

    stop_poll = threading.Event()

    def poll():
        while not stop_poll.is_set():
            try:
                current = len([f for f in os.listdir(download_dir)
                               if os.path.isfile(os.path.join(download_dir, f))])
            except OSError:
                current = baseline
            job.set_stats(downloaded=max(0, current - baseline), status_text="downloading")
            time.sleep(0.8)

    poller = threading.Thread(target=poll, daemon=True)
    poller.start()

    try:
        count = download_url_list(
            file_path=file_path,
            download_dir=download_dir,
            timeout=timeout,
            rate_limit=rate_limit,
            min_width=min_width,
            min_height=min_height,
            stop_checker=lambda: job.stop_requested,
        )
        job.set_stats(
            downloaded=count,
            status_text="stopped" if job.stop_requested else "finished",
        )
        if job.stop_requested:
            job.add_log("URL-list download stopped by user.", "warn")
        else:
            job.add_log(f"Done. Saved {count} images to {download_dir}.", "success")
    finally:
        stop_poll.set()
        src_logger.removeHandler(handler)
        if temp_path:
            try:
                os.remove(temp_path)
            except OSError:
                pass
