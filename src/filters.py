"""
Filters module for filtering image URLs based on various criteria.
"""

from typing import List, Set
from .utils import is_allowed_image_url
import logging

logger = logging.getLogger(__name__)

def filter_image_urls(image_urls: Set[str], min_width: int, min_height: int,
                      allowed_formats: List[str], skip_keywords: List[str]) -> Set[str]:
    """
    Filter a set of image URLs based on basic criteria (extension and skip keywords).
    Note: Actual dimension checking requires downloading the image, which is done in the downloader.

    Args:
        image_urls (Set[str]): Set of image URLs to filter.
        min_width (int): Minimum width in pixels (used later in downloader).
        min_height (int): Minimum height in pixels (used later in downloader).
        allowed_formats (List[str]): List of allowed image extensions.
        skip_keywords (List[str]): List of keywords to skip (e.g., 'thumb', 'thumbnail').

    Returns:
        Set[str]: Filtered set of image URLs.
    """
    filtered = set()
    for url in image_urls:
        if is_allowed_image_url(url, allowed_formats, skip_keywords):
            filtered.add(url)
        else:
            logger.debug(f"Filtered out URL (format/keyword): {url}")

    logger.info(f"Filtered {len(image_urls)} URLs down to {len(filtered)} based on format and keywords.")
    return filtered

# Note: Dimension-based filtering will be done in the downloader after downloading the image,
# because we need to check the actual image dimensions.