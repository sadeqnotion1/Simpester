"""
Downloader module for downloading and saving images.
"""

import os
import requests
from typing import Set
from PIL import Image
from io import BytesIO
import logging
from .utils import get_filename_from_url, normalize_url

logger = logging.getLogger(__name__)

class ImageDownloader:
    def __init__(self, download_dir: str, min_width: int = 800, min_height: int = 600,
                 timeout: int = 30, rate_limit: float = 1.0):
        """
        Initialize the ImageDownloader.

        Args:
            download_dir (str): Directory to save downloaded images.
            min_width (int): Minimum width for an image to be considered high quality.
            min_height (int): Minimum height for an image to be considered high quality.
            timeout (int): Timeout for HTTP requests in seconds.
            rate_limit (float): Minimum time between requests in seconds.
        """
        self.download_dir = download_dir
        self.min_width = min_width
        self.min_height = min_height
        self.timeout = timeout
        self.rate_limit = rate_limit
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        # Ensure download directory exists
        os.makedirs(self.download_dir, exist_ok=True)

    def download_image(self, url: str) -> bool:
        """
        Download a single image and save it if it meets the quality criteria.

        Args:
            url (str): The URL of the image to download.

        Returns:
            bool: True if the image was downloaded and saved, False otherwise.
        """
        try:
            # Respect rate limit
            import time
            time.sleep(self.rate_limit)

            response = self.session.get(url, timeout=self.timeout, stream=True)
            response.raise_for_status()

            # Check content type to ensure it's an image
            content_type = response.headers.get('content-type', '')
            if not content_type.startswith('image/'):
                logger.debug(f"Skipping non-image URL (content-type: {content_type}): {url}")
                return False

            # Read the image content
            img_data = response.content
            try:
                img = Image.open(BytesIO(img_data))
                width, height = img.size
            except Exception as e:
                logger.debug(f"Failed to open image data: {e}")
                return False

            # Check dimensions
            if width < self.min_width or height < self.min_height:
                logger.debug(f"Skipping image due to dimensions ({width}x{height}): {url}")
                return False

            # Generate filename
            filename = get_filename_from_url(url)
            # Ensure the filename is unique in the download directory
            base, ext = os.path.splitext(filename)
            counter = 1
            while os.path.exists(os.path.join(self.download_dir, filename)):
                filename = f"{base}_{counter}{ext}"
                counter += 1

            # Save the image
            filepath = os.path.join(self.download_dir, filename)
            with open(filepath, 'wb') as f:
                f.write(img_data)

            logger.info(f"Saved image: {filepath} ({width}x{height})")
            return True

        except requests.RequestException as e:
            logger.error(f"Failed to download {url}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error downloading {url}: {e}")
            return False

    def download_images(self, image_urls: Set[str], stop_checker=None) -> int:
        """
        Download a set of image URLs.

        Args:
            image_urls (Set[str]): Set of image URLs to download.
            stop_checker (callable, optional): Function returning True if downloading should abort.

        Returns:
            int: Number of images successfully downloaded.
        """
        successful = 0
        for url in image_urls:
            if stop_checker and stop_checker():
                logger.info("Download cancelled by user stop request.")
                break
            if self.download_image(url):
                successful += 1
        logger.info(f"Downloaded {successful} out of {len(image_urls)} images.")
        return successful