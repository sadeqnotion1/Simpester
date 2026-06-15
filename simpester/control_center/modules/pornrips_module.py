"""Adapter for the Pornripsto bulk downloader.

This is a faithful, callback-driven port of Pornripsto/pornrips_bulk_downloader.py:
same crawl → resolve → download flow (date index page → 1080p posts → torrents +
pixhost screenshots, in parallel), but every `print` becomes a job log line and
progress is pushed into job.stats so the GUI can render it live. The original
standalone script is left untouched in the repo.
"""

import os
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

SITE = "ht" + "tps://pornrips.to"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

DEFAULT_EXCLUDED = [
    "Brazzers", "Naughty America", "Reality Kings", "Digital Playground",
]


def _fetch_url(url, timeout=30):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="replace")


def _download_binary(url, dest_path, timeout=60):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    with open(dest_path, "wb") as fh:
        fh.write(data)
    return len(data)


def _sanitize(name):
    name = re.sub(r"[<>:\"/\\|?*]", "_", name or "").strip()
    return (name or "untitled")[:150]


def torrent_to_magnet(torrent_path):
    """Best-effort conversion of a .torrent file to a magnet link (bencode parse)."""
    import hashlib

    try:
        with open(torrent_path, "rb") as fh:
            data = fh.read()
    except OSError:
        return None

    marker = b"4:info"
    idx = data.find(marker)
    if idx == -1:
        return None
    info_start = idx + len(marker)

    def _parse(buf, pos):
        token = buf[pos:pos + 1]
        if token == b"d" or token == b"l":
            pos += 1
            while buf[pos:pos + 1] != b"e":
                if token == b"d":
                    pos = _parse(buf, pos)  # key (string)
                pos = _parse(buf, pos)      # value
            return pos + 1
        if token == b"i":
            end = buf.index(b"e", pos)
            return end + 1
        colon = buf.index(b":", pos)
        length = int(buf[pos:colon])
        return colon + 1 + length

    try:
        info_end = _parse(data, info_start)
    except (ValueError, IndexError):
        return None
    info_hash = hashlib.sha1(data[info_start:info_end]).hexdigest()
    return "magnet:?xt=urn:btih:" + info_hash


def scrape_date_page(date_normalized, max_pages, job, search_term=""):
    """Collect post URLs from one date index, following pagination.

    If `search_term` is given, only posts whose listing title contains it
    (case-insensitive) are kept — filtered at the index level so we never fetch
    non-matching post pages.
    """
    term = (search_term or "").strip().lower()
    post_urls = []
    seen = set()
    page = 1
    while page <= max_pages and not job.stop_requested:
        if page == 1:
            url = SITE + "/" + date_normalized + "/"
        else:
            url = SITE + "/" + date_normalized + "/page/" + str(page) + "/"
        job.add_log("Scanning index page " + str(page) + ": " + url)
        try:
            html = _fetch_url(url)
        except Exception as exc:  # noqa: BLE001
            job.add_log("Index page " + str(page) + " unavailable (" + str(exc) + "). Stopping pagination.", "warn")
            break

        matches = re.findall(
            r'<h2 class=["\']?entry-title["\']?><a\s+[^>]*href=["\']?([^"\'\s>]+)["\']?[^>]*>([^<]+)</a>',
            html,
        )
        if not matches:
            matches = re.findall(
                r'<a\s+[^>]*href=["\']?([^"\'\s>]+)["\']?\s+rel=["\']?bookmark["\']?>([^<]+)</a>',
                html,
            )

        new = []
        for href, title in matches:
            if not href.startswith("http") or href in seen:
                continue
            if term and term not in title.lower():
                continue
            seen.add(href)
            post_urls.append(href)
            new.append(href)

        job.add_log("  found " + str(len(new)) + " matching posts (total " + str(len(post_urls)) + ")")
        job.set_stats(posts_found=len(post_urls), pages=page)
        if not matches:
            break
        page += 1
    return post_urls


def scrape_movie_details(post_url, job):
    """Resolve a single post: title, 1080p torrent link, screenshot images."""
    html = _fetch_url(post_url)
    title_match = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
    title = _sanitize(title_match.group(1)) if title_match else _sanitize(post_url.rsplit("/", 1)[-1])

    if "1080p" not in html and "1080P" not in html:
        return None  # keep parity with the original: 1080p posts only

    torrents = re.findall(r'href="([^"]+\.torrent)"', html)
    screenshots = re.findall(r'(https://img\d*\.pixhost\.to/images/[^\s"\']+\.(?:jpg|jpeg|png|webp))', html)
    magnets = re.findall(r'(magnet:\?xt=urn:btih:[^\s"\']+)', html)

    return {
        "title": title,
        "url": post_url,
        "torrents": list(dict.fromkeys(torrents)),
        "screenshots": list(dict.fromkeys(screenshots)),
        "magnets": list(dict.fromkeys(magnets)),
    }


def scan_studios(path):
    """Infer studio names from the sub-folder names of a previously-downloaded
    folder. A folder like 'BangBros18.24.06.01.Jane.Doe.1080p' yields
    'BangBros18' (text before the .YY.MM.DD. date marker, else before the first
    dot). Returns a case-insensitively sorted, de-duplicated list."""
    if not path or not os.path.isdir(path):
        return []
    studios = set()
    for entry in os.scandir(path):
        if not entry.is_dir():
            continue
        name = entry.name
        m = re.search(r"\.\d{2,4}\.\d{2}\.\d{2}\.", name)
        studio = (name[:m.start()] if m else name.split(".")[0]).strip()
        if studio:
            studios.add(studio)
    return sorted(studios, key=str.lower)


def scrape_date_range(date_start, date_end, max_pages, job, search_term=""):
    """Iterate each day in [date_start, date_end] inclusive, collecting post URLs
    (optionally filtered by search_term). Dates use slash format YYYY/MM/DD."""
    from datetime import datetime, timedelta

    def _parse(d):
        return datetime.strptime((d or "").strip().replace("-", "/").strip("/"), "%Y/%m/%d")

    try:
        start = _parse(date_start)
        end = _parse(date_end)
    except ValueError:
        raise ValueError("Dates must look like 2026-06-01 (or 2026/06/01).")
    if end < start:
        start, end = end, start

    all_urls, seen = [], set()
    day = start
    while day <= end and not job.stop_requested:
        ds = day.strftime("%Y/%m/%d")
        job.add_log("── Date " + ds + " ──")
        for u in scrape_date_page(ds, max_pages, job, search_term):
            if u not in seen:
                seen.add(u)
                all_urls.append(u)
        day += timedelta(days=1)
    job.add_log("Range complete: " + str(len(all_urls)) + " unique matching posts.")
    return all_urls


def _date_from_title(title):
    """Parse the release date from a pornrips title's .YY.MM.DD. marker.
    'BlackedRaw.24.03.25.Bella.Rolland…' -> datetime(2024, 3, 25). None if absent."""
    from datetime import datetime
    m = re.search(r"\.(\d{2,4})\.(\d{2})\.(\d{2})\.", title or "")
    if not m:
        return None
    y, mm, dd = (int(x) for x in m.groups())
    if y < 100:
        y += 2000
    try:
        return datetime(y, mm, dd)
    except ValueError:
        return None

def scrape_search(term, max_pages, job, date_start=None, date_end=None):
    """Use pornrips.to's own search (?s=term), paginating /page/N/?s=term.
    Optionally keep only posts whose release date (parsed from the title) falls
    within [date_start, date_end] inclusive. Dates use slash format YYYY/MM/DD."""
    from datetime import datetime
    import urllib.parse

    def _parse(d):
        d = (d or "").strip().replace("-", "/").strip("/")
        return datetime.strptime(d, "%Y/%m/%d") if d else None

    try:
        start = _parse(date_start)
        end = _parse(date_end)
    except ValueError:
        raise ValueError("Dates must look like 2026-06-01 (or 2026/06/01).")
    if start and end and end < start:
        start, end = end, start
    if start and not end:
        end = start

    q = urllib.parse.quote_plus(term.strip())
    post_urls, seen = [], set()
    page = 1
    while page <= max_pages and not job.stop_requested:
        if page == 1:
            url = SITE + "/?s=" + q
        else:
            url = SITE + "/page/" + str(page) + "/?s=" + q
        job.add_log("Searching page " + str(page) + ": " + url)
        try:
            html = _fetch_url(url)
        except Exception as exc:  # noqa: BLE001
            job.add_log("Search page " + str(page) + " unavailable (" + str(exc) + "). Stopping.", "warn")
            break

        matches = re.findall(
            r'<h2 class=["\']?entry-title["\']?><a\s+[^>]*href=["\']?([^"\'\s>]+)["\']?[^>]*>([^<]+)</a>',
            html,
        )
        if not matches:
            matches = re.findall(
                r'<a\s+[^>]*href=["\']?([^"\'\s>]+)["\']?\s+rel=["\']?bookmark["\']?>([^<]+)</a>',
                html,
            )
        if not matches:
            job.add_log("  no more search results.")
            break

        kept = 0
        for href, title in matches:
            if not href.startswith("http") or href in seen:
                continue
            if start or end:
                d = _date_from_title(title)
                if d is not None and ((start and d < start) or (end and d > end)):
                    continue
            seen.add(href)
            post_urls.append(href)
            kept += 1
        job.add_log("  kept " + str(kept) + " posts (total " + str(len(post_urls)) + ")")
        job.set_stats(posts_found=len(post_urls), pages=page)
        page += 1
    return post_urls


def run_pornrips(job, params):
    raw_date = (params.get("date") or params.get("date_start") or "").strip()
    raw_end = (params.get("date_end") or "").strip()
    search_term = (params.get("search_term") or "").strip()

    date_normalized = raw_date.replace("-", "/").strip("/")
    end_normalized = raw_end.replace("-", "/").strip("/")
    if not date_normalized and not search_term:
        raise ValueError("Provide a date/start date, or a search term.")

    is_range = bool(end_normalized) and end_normalized != date_normalized

    parts = []
    if search_term:
        parts.append(re.sub(r"[^\w\-]+", "_", search_term).strip("_") or "search")
    if is_range:
        parts.append(date_normalized.replace("/", "-") + "_to_" + end_normalized.replace("/", "-"))
    elif date_normalized:
        parts.append(date_normalized.replace("/", "-"))
    label = "_".join(parts) or "pornrips"

    out_dir = params.get("output_dir") or os.path.join(
        os.getcwd(), "downloads", "pornrips", label
    )
    os.makedirs(out_dir, exist_ok=True)

    max_pages = int(params.get("max_pages") or 5)
    workers = int(params.get("workers") or 5)
    excluded = params.get("excluded")
    if isinstance(excluded, str):
        excluded = [e.strip() for e in excluded.split(",") if e.strip()]
    excluded = excluded or DEFAULT_EXCLUDED
    excluded_lower = [e.lower() for e in excluded]

    adv_mode = (params.get("advanced_filter_mode") or "Disabled").strip().capitalize()
    if adv_mode not in ("Disabled", "Include", "Exclude"):
        adv_mode = "Disabled"
    selected = params.get("selected_studios")
    if isinstance(selected, str):
        selected = [s.strip() for s in selected.split(",") if s.strip()]
    selected = selected or []
    selected_lower = [s.lower() for s in selected]
    if adv_mode != "Disabled" and selected_lower:
        job.add_log("Advanced filter: " + adv_mode + " → " + ", ".join(selected))
    elif adv_mode != "Disabled":
        job.add_log("Advanced filter set to " + adv_mode + " but no studios listed; ignoring.", "warn")
        adv_mode = "Disabled"

    job.set_stats(date=label, posts_found=0, resolved=0, files=0, total_mb=0.0, skipped=0)
    job.add_log("Output → " + out_dir)
    job.add_log("Excluded studios: " + ", ".join(excluded))

    if search_term:
        job.add_log("Search mode → " + SITE + "/?s=" + search_term)
        if date_normalized or end_normalized:
            job.add_log("Date window: " + (date_normalized or "any") + " → " + (end_normalized or date_normalized or "any"))
        post_urls = scrape_search(
            search_term, max_pages, job,
            date_start=date_normalized or None,
            date_end=end_normalized or None,
        )
    elif is_range:
        job.add_log("Date range: " + date_normalized + " → " + end_normalized)
        post_urls = scrape_date_range(date_normalized, end_normalized, max_pages, job)
    else:
        post_urls = scrape_date_page(date_normalized, max_pages, job)
    if job.stop_requested:
        return
    if not post_urls:
        job.add_log("No posts found for that date.", "warn")
        return

    job.add_log("Resolving " + str(len(post_urls)) + " posts with " + str(workers) + " workers…")

    magnets_path = os.path.join(out_dir, "magnets.txt")
    total_bytes = [0]
    counters = {"files": 0, "resolved": 0, "skipped": 0}

    def handle_post(post_url):
        if job.stop_requested:
            return
        try:
            details = scrape_movie_details(post_url, job)
        except Exception as exc:  # noqa: BLE001
            job.add_log("Failed to resolve " + post_url + ": " + str(exc), "error")
            return
        if not details:
            counters["skipped"] += 1
            job.set_stats(skipped=counters["skipped"])
            return

        title_lower = details["title"].lower()
        if any(bad in title_lower for bad in excluded_lower):
            counters["skipped"] += 1
            job.set_stats(skipped=counters["skipped"])
            job.add_log("Skipping excluded studio: " + details["title"])
            return

        if adv_mode != "Disabled" and selected_lower:
            matched = any(s in title_lower for s in selected_lower)
            if adv_mode == "Exclude" and matched:
                counters["skipped"] += 1
                job.set_stats(skipped=counters["skipped"])
                job.add_log("Skipping (advanced blacklist): " + details["title"])
                return
            if adv_mode == "Include" and not matched:
                counters["skipped"] += 1
                job.set_stats(skipped=counters["skipped"])
                job.add_log("Skipping (advanced whitelist): " + details["title"])
                return

        counters["resolved"] += 1
        job.set_stats(resolved=counters["resolved"])
        post_dir = os.path.join(out_dir, _sanitize(details["title"]))
        os.makedirs(post_dir, exist_ok=True)
        job.add_log("✓ " + details["title"], "success")

        magnets = list(details["magnets"])

        for i, torrent_url in enumerate(details["torrents"]):
            if job.stop_requested:
                return
            torrent_path = os.path.join(post_dir, "file_" + str(i + 1) + ".torrent")
            try:
                size = _download_binary(torrent_url, torrent_path)
                total_bytes[0] += size
                counters["files"] += 1
                magnet = torrent_to_magnet(torrent_path)
                if magnet:
                    magnets.append(magnet)
            except Exception as exc:  # noqa: BLE001
                job.add_log("  torrent failed: " + str(exc), "warn")

        for j, shot in enumerate(details["screenshots"]):
            if job.stop_requested:
                return
            ext = shot.rsplit(".", 1)[-1].split("?")[0]
            shot_path = os.path.join(post_dir, "screenshot_" + str(j + 1) + "." + ext)
            try:
                size = _download_binary(shot, shot_path)
                total_bytes[0] += size
                counters["files"] += 1
            except Exception as exc:  # noqa: BLE001
                job.add_log("  screenshot failed: " + str(exc), "warn")

        if magnets:
            with open(magnets_path, "a", encoding="utf-8") as fh:
                for m in dict.fromkeys(magnets):
                    fh.write(m + "\n")

        job.set_stats(
            files=counters["files"],
            total_mb=round(total_bytes[0] / (1024 * 1024), 2),
        )

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(handle_post, u) for u in post_urls]
        for _ in as_completed(futures):
            if job.stop_requested:
                break

    job.set_stats(
        files=counters["files"],
        resolved=counters["resolved"],
        skipped=counters["skipped"],
        total_mb=round(total_bytes[0] / (1024 * 1024), 2),
    )
    if job.stop_requested:
        job.add_log("Pornripsto stopped by user.", "warn")
    else:
        job.add_log(
            "Done. Resolved " + str(counters["resolved"]) + " posts, downloaded "
            + str(counters["files"]) + " files ("
            + str(round(total_bytes[0] / (1024 * 1024), 2)) + " MB). Magnets → " + magnets_path,
            "success",
        )
