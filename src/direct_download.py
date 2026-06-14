"""
Direct file downloader for fetching images from a list of URLs.
Handles jpg6.su oembed pages to extract full-size images.
Checks image dimensions to skip thumbnails.
"""

import os
import re
import time
import logging
import requests
from urllib.parse import quote, unquote, urlparse
from io import BytesIO
from typing import Callable, Optional, Set
from PIL import Image

logger = logging.getLogger(__name__)

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'


def _format_size(size_bytes: int) -> str:
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def _is_jpg6_url(url: str) -> bool:
    return 'jpg6.su/img/' in url


def _resolve_jpg6_url(session: requests.Session, url: str, timeout: int) -> Optional[str]:
    """
    Resolve a jpg6.su page URL to the full-size image URL via the oembed API.
    Returns the direct download URL or None.
    """
    try:
        encoded_url = quote(url, safe='')
        oembed_url = f'https://jpg6.su/oembed/?url={encoded_url}&format=json'
        resp = session.get(oembed_url, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()

        img_url = data.get('url', '')
        if not img_url:
            return None

        # The oembed 'url' gives .md.jpg (medium). Remove .md to get full size.
        if img_url.endswith('.md.jpg'):
            img_url = img_url[:-len('.md.jpg')] + '.jpg'
        elif img_url.endswith('.md.png'):
            img_url = img_url[:-len('.md.png')] + '.png'
        elif img_url.endswith('.md.webp'):
            img_url = img_url[:-len('.md.webp')] + '.webp'

        return img_url

    except Exception as e:
        logger.error(f"Failed to resolve jpg6.oembed for {url}: {e}")
        return None


def _get_filename_from_url(url: str) -> str:
    try:
        path = urlparse(url).path
        filename = unquote(os.path.basename(path))
        if filename and '.' in filename:
            return filename
    except Exception:
        pass
    import hashlib
    ext = os.path.splitext(urlparse(url).path)[1] or '.jpg'
    return hashlib.md5(url.encode()).hexdigest()[:12] + ext


def _make_unique(filename: str, seen: Set[str], download_dir: str) -> str:
    base, ext = os.path.splitext(filename)
    if filename in seen:
        counter = 1
        while f"{base}_{counter}{ext}" in seen:
            counter += 1
        filename = f"{base}_{counter}{ext}"
    seen.add(filename)

    final_path = os.path.join(download_dir, filename)
    counter = 1
    while os.path.exists(final_path):
        filename = f"{base}_{counter}{ext}"
        final_path = os.path.join(download_dir, filename)
        counter += 1

    return filename


def download_url_list(
    file_path: str,
    download_dir: str,
    timeout: int = 30,
    rate_limit: float = 1.0,
    min_width: int = 800,
    min_height: int = 600,
    stop_checker: Optional[Callable[[], bool]] = None,
) -> int:
    """
    Download images listed in a text file, skipping thumbnails.

    For jpg6.su URLs, resolves via the oembed API to get the full-size image.
    Checks image dimensions to skip thumbnails.

    Args:
        file_path: Path to the text file containing URLs (one per line).
        download_dir: Directory to save downloaded files.
        timeout: HTTP request timeout in seconds.
        rate_limit: Delay between downloads in seconds.
        min_width: Minimum image width to accept.
        min_height: Minimum image height to accept.
        stop_checker: Callable returning True to abort early.

    Returns:
        Number of images successfully downloaded.
    """
    os.makedirs(download_dir, exist_ok=True)

    with open(file_path, 'r', encoding='utf-8') as f:
        urls = [line.strip() for line in f if line.strip() and not line.strip().startswith('#')]

    if not urls:
        logger.warning(f"No URLs found in {file_path}")
        return 0

    logger.info(f"Found {len(urls)} URLs in {file_path}. Starting downloads...")
    logger.info(f"Image size filter: min {min_width}x{min_height} px")

    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT})

    successful = 0
    skipped = 0
    failed = 0
    seen_filenames: Set[str] = set()

    for i, url in enumerate(urls, 1):
        if stop_checker and stop_checker():
            logger.info("Download cancelled by user.")
            break

        try:
            logger.info(f"[{i}/{len(urls)}] {url}")

            if rate_limit > 0 and i > 1:
                time.sleep(rate_limit)

            # Resolve jpg6.su page URL to direct image URL
            if _is_jpg6_url(url):
                direct_url = _resolve_jpg6_url(session, url, timeout)
                if not direct_url:
                    logger.warning(f"  -> Skipped (could not resolve image URL)")
                    skipped += 1
                    continue
                logger.info(f"  -> Resolved: {direct_url}")
            else:
                direct_url = url

            # Download image content
            resp = session.get(direct_url, timeout=timeout, stream=True, allow_redirects=True)
            resp.raise_for_status()

            content = resp.content
            data_size = len(content)

            # Try to open as image and check dimensions
            try:
                img = Image.open(BytesIO(content))
                width, height = img.size
            except Exception as e:
                logger.warning(f"  -> Skipped (not a valid image): {e}")
                skipped += 1
                continue

            # Filter thumbnails
            if width < min_width or height < min_height:
                logger.info(f"  -> Skipped thumbnail ({width}x{height} < {min_width}x{min_height})")
                skipped += 1
                continue

            # Build filename
            filename = _get_filename_from_url(direct_url)
            img_format = img.format
            if img_format:
                ext_map = {'JPEG': '.jpg', 'PNG': '.png', 'WEBP': '.webp', 'GIF': '.gif'}
                proper_ext = ext_map.get(img_format, '.jpg')
                base, cur_ext = os.path.splitext(filename)
                if cur_ext.lower() not in ['.jpg', '.jpeg', '.png', '.webp', '.gif']:
                    filename = base + proper_ext

            filename = _make_unique(filename, seen_filenames, download_dir)

            # Save
            filepath = os.path.join(download_dir, filename)
            with open(filepath, 'wb') as f:
                f.write(content)

            logger.info(f"  -> Saved: {filename} ({width}x{height}, {_format_size(data_size)})")
            successful += 1

        except requests.RequestException as e:
            logger.error(f"  -> Failed: {e}")
            failed += 1
        except Exception as e:
            logger.error(f"  -> Error: {e}")
            failed += 1

    logger.info(f"Done. Downloaded: {successful}, Skipped: {skipped}, Failed: {failed}")
    return successful
