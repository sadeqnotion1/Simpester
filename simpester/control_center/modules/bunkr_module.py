"""Adapter for the Fetch Wallpaper Bunkr.cr extractor (src/bunkr_download.py).

Drives the existing resolve_bunkr_links() to turn a bunkr album/file URL into
signed CDN download links, pipes its logging output into the job log, then
(optionally) downloads each resolved link to disk. The original module is left
untouched.
"""

import logging
import os
import threading  # noqa: F401  (kept for parity with sibling modules)
import time
import urllib.parse
import urllib.request
from datetime import datetime

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

class _JobLogHandler(logging.Handler):
    """Pipe the resolver's logging records into the job log."""

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

def _filename_from_url(url):
    path = urllib.parse.urlparse(url).path
    name = urllib.parse.unquote(os.path.basename(path)).split("?")[0]
    return name or "file"

def _download_binary(url, dest_path, timeout=60):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    with open(dest_path, "wb") as fh:
        fh.write(data)
    return len(data)

def run_bunkr(job, params):
    from src.bunkr_download import resolve_bunkr_links

    url = (params.get("url") or "").strip()
    if not url:
        raise ValueError("A bunkr.cr album or file URL is required.")

    timeout = _as(params.get("timeout"), int, 30)
    rate_limit = _as(params.get("rate_limit"), float, 1.0)
    do_download = bool(params.get("download", True))
    download_dir = params.get("download_dir") or os.path.join(
        os.getcwd(), "downloads", "bunkr"
    )
    os.makedirs(download_dir, exist_ok=True)

    job.set_stats(links=0, downloaded=0, total_mb=0.0, status_text="resolving")
    job.add_log("Resolving bunkr URL: " + url)
    job.add_log("Output → " + download_dir)

    # Capture the resolver's `logging` output into the job log.
    handler = _JobLogHandler(job)
    handler.setFormatter(logging.Formatter("%(message)s"))
    handler.setLevel(logging.INFO)
    src_logger = logging.getLogger("src")
    src_logger.setLevel(logging.INFO)
    src_logger.addHandler(handler)

    try:
        links = resolve_bunkr_links(
            url,
            timeout=timeout,
            rate_limit=rate_limit,
            stop_checker=lambda: job.stop_requested,
        )
        job.set_stats(links=len(links))
        job.add_log("Resolved " + str(len(links)) + " download link(s).", "success")

        if links:
            stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            links_path = os.path.join(download_dir, "bunkr_links_" + stamp + ".txt")
            with open(links_path, "w", encoding="utf-8") as fh:
                fh.write("\n".join(links) + "\n")
            job.add_log("Saved link list → " + links_path)

        if not do_download:
            job.add_log("Resolve-only mode: skipping downloads.", "warn")
            return
        if job.stop_requested:
            return

        job.set_stats(status_text="downloading")
        total_bytes = 0
        downloaded = 0
        seen = set()
        for i, link in enumerate(links, 1):
            if job.stop_requested:
                break
            name = _filename_from_url(link)
            base, ext = os.path.splitext(name)
            n = 1
            while name in seen or os.path.exists(os.path.join(download_dir, name)):
                name = base + "_" + str(n) + ext
                n += 1
            seen.add(name)
            dest = os.path.join(download_dir, name)
            try:
                if rate_limit > 0 and i > 1:
                    time.sleep(rate_limit)
                size = _download_binary(link, dest, timeout=max(timeout, 60))
                total_bytes += size
                downloaded += 1
                job.add_log(
                    "[" + str(i) + "/" + str(len(links)) + "] saved " + name
                    + " (" + str(round(size / (1024 * 1024), 2)) + " MB)",
                    "success",
                )
                job.set_stats(
                    downloaded=downloaded,
                    total_mb=round(total_bytes / (1024 * 1024), 2),
                )
            except Exception as exc:  # noqa: BLE001
                job.add_log("[" + str(i) + "/" + str(len(links)) + "] failed: " + str(exc), "error")

        job.set_stats(
            downloaded=downloaded,
            total_mb=round(total_bytes / (1024 * 1024), 2),
            status_text="stopped" if job.stop_requested else "finished",
        )
        if job.stop_requested:
            job.add_log("Bunkr extractor stopped by user.", "warn")
        else:
            job.add_log(
                "Done. Downloaded " + str(downloaded) + " file(s) ("
                + str(round(total_bytes / (1024 * 1024), 2)) + " MB).",
                "success",
            )
    finally:
        src_logger.removeHandler(handler)
