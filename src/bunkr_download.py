"""
Bunkr.cr link extractor.
Resolves bunkr file/album pages to signed CDN download URLs.
"""

import re
import time
import logging
import requests
from urllib.parse import urlparse, quote
from typing import Callable, List, Optional

logger = logging.getLogger(__name__)

USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'


def _parse_bunkr_url(url: str) -> tuple:
    url = url.strip()
    m = re.search(r'bunkr\.\w+/([af])/(\w+)', url)
    if m:
        kind = 'album' if m.group(1) == 'a' else 'file'
        return kind, m.group(2)
    return None, None


def _get_file_slugs_from_album(session: requests.Session, url: str, timeout: int) -> List[str]:
    r = session.get(url, timeout=timeout)
    r.raise_for_status()
    return re.findall(r'href="/f/([^"]+)"', r.text)


def _get_file_info(session: requests.Session, file_url: str, timeout: int) -> Optional[dict]:
    r = session.get(file_url, timeout=timeout)
    r.raise_for_status()
    html = r.text

    jsCDN_match = re.search(r'var jsCDN\s*=\s*"([^"]+)"', html)
    if not jsCDN_match:
        return None
    jsCDN = jsCDN_match.group(1).replace('\\/', '/')

    sign_match = re.search(r'var signUrl\s*=\s*"([^"]+)"', html)
    sign_url = sign_match.group(1).replace('\\/', '/') if sign_match else 'https://glb-apisign.cdn.cr/sign'

    title_match = re.search(r'property="og:title"\s+content="([^"]+)"', html)
    name = title_match.group(1) if title_match else ''

    return {'jsCDN': jsCDN, 'name': name, 'sign_url': sign_url}


def _sign_url(session: requests.Session, jsCDN: str, sign_url: str, timeout: int) -> Optional[str]:
    parsed = urlparse(jsCDN)
    path = parsed.path

    resp = session.get(f'{sign_url}?path={quote(path, safe="")}', timeout=timeout)
    resp.raise_for_status()
    data = resp.json()

    token = data.get('token')
    ex = data.get('ex')
    if not token or not ex:
        return None

    return f"{jsCDN}?token={token}&ex={ex}"


def resolve_bunkr_links(
    url: str,
    timeout: int = 30,
    rate_limit: float = 1.0,
    stop_checker: Optional[Callable[[], bool]] = None,
) -> List[str]:
    """
    Resolve a bunkr.cr URL to a list of signed download links.
    Saves the links to a .txt file next to the downloads folder.

    Args:
        url: Bunkr URL (album /a/slug or file /f/slug).
        timeout: HTTP request timeout.
        rate_limit: Delay between requests.
        stop_checker: Callable returning True to abort.

    Returns:
        List of signed download URLs.
    """
    import os

    kind, slug = _parse_bunkr_url(url)
    if not kind:
        logger.error(f"Invalid bunkr URL: {url}")
        return []

    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT})

    file_slugs = []
    if kind == 'album':
        logger.info(f"Fetching album: {url}")
        file_slugs = _get_file_slugs_from_album(session, url, timeout)
        logger.info(f"Found {len(file_slugs)} files in album")
    else:
        file_slugs = [slug]

    links = []
    for i, file_slug in enumerate(file_slugs, 1):
        if stop_checker and stop_checker():
            logger.info("Stopped by user.")
            break

        try:
            file_url = f'https://bunkr.cr/f/{file_slug}'
            logger.info(f"[{i}/{len(file_slugs)}] {file_url}")

            if rate_limit > 0 and i > 1:
                time.sleep(rate_limit)

            info = _get_file_info(session, file_url, timeout)
            if not info:
                logger.warning(f"  -> Could not extract info")
                continue

            signed = _sign_url(session, info['jsCDN'], info['sign_url'], timeout)
            if not signed:
                logger.warning(f"  -> Could not sign URL")
                continue

            name = info['name']
            logger.info(f"  -> {name}")
            logger.info(f"  -> {signed}")
            links.append(signed)

        except requests.RequestException as e:
            logger.error(f"  -> Failed: {e}")
        except Exception as e:
            logger.error(f"  -> Error: {e}")

    # Save links to txt file
    if links:
        from datetime import datetime
        out_dir = os.path.join(os.getcwd(), 'downloads')
        os.makedirs(out_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        out_file = os.path.join(out_dir, f'bunkr_links_{timestamp}.txt')
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write('\n'.join(links) + '\n')
        logger.info(f"Saved {len(links)} links to: {out_file}")

    logger.info(f"Resolved {len(links)} download links.")
    return links
