"""
Utility functions for the Fetch Wallpaper scraper.
"""

import logging
import sys
import re
from urllib.parse import urlparse
from typing import Optional

def setup_logging(verbose: bool = False) -> None:
    """
    Set up logging configuration.

    Args:
        verbose (bool): If True, set logging level to DEBUG, else INFO.
    """
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

def is_valid_url(url: str) -> bool:
    """
    Check if a string is a valid URL.

    Args:
        url (str): The string to check.

    Returns:
        bool: True if the string is a valid URL, False otherwise.
    """
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def normalize_url(url: str) -> str:
    """
    Normalize a URL by removing fragments and normalizing the scheme.

    Args:
        url (str): The URL to normalize.

    Returns:
        str: Normalized URL.
    """
    parsed = urlparse(url)
    # Remove fragment
    normalized = parsed._replace(fragment="").geturl()
    # Ensure scheme is http or https (if not, default to http?)
    # We'll leave it as is for now.
    return normalized

def is_allowed_image_url(url: str, allowed_formats: list, skip_keywords: list) -> bool:
    """
    Check if a URL points to an allowed image file based on extension and skip keywords.

    Args:
        url (str): The URL to check.
        allowed_formats (list): List of allowed image extensions (without dot).
        skip_keywords (list): List of keywords that, if present in the URL, indicate a thumbnail or low-res image.

    Returns:
        bool: True if the URL is allowed, False otherwise.
    """
    # Check extension
    if not any(url.lower().endswith(f".{fmt}") for fmt in allowed_formats):
        return False

    # Check skip keywords
    lower_url = url.lower()
    for keyword in skip_keywords:
        if keyword in lower_url:
            return False

    return True

def get_filename_from_url(url: str) -> str:
    """
    Extract a filename from a URL.

    Args:
        url (str): The URL.

    Returns:
        str: The filename (including extension).
    """
    parsed = urlparse(url)
    filename = parsed.path.split('/')[-1]
    if not filename:
        # If no filename in path, use a default
        filename = "image.jpg"
    return filename