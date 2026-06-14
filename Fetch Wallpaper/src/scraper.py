"""
Scraper module for fetching and parsing web pages to extract image URLs.
"""

import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import logging
from typing import List, Set, Optional
from .utils import is_valid_url, normalize_url
from .filters import filter_image_urls
from .downloader import ImageDownloader

logger = logging.getLogger(__name__)

class WallpaperScraper:
    def __init__(self, site_name: str, config_path: str = None):
        """
        Initialize the scraper for a given site.

        Args:
            site_name (str): Name of the site to scrape (used to load site-specific config).
            config_path (str, optional): Path to a custom config file. If None, uses default.
        """
        self.site_name = site_name
        self.config = self._load_config(config_path)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.visited_urls: Set[str] = set()
        self.image_urls: Set[str] = set()
        self.stop_requested = False
        import threading
        self.lock = threading.Lock()
        self.cv = None

    def _load_config(self, config_path: str = None) -> dict:
        """
        Load configuration from YAML files.

        Args:
            config_path (str, optional): Path to a custom config file. If None, uses default.

        Returns:
            dict: Configuration dictionary.
        """
        import yaml
        import os

        # Default configuration
        default_config = {
            'general': {
                'min_width': 800,
                'min_height': 600,
                'allowed_formats': ['jpg', 'jpeg', 'png', 'webp'],
                'skip_keywords': ['thumb', 'thumbnail', 'small', 'lowres'],
                'download_dir': './downloads',
                'rate_limit': 1.0,
                'timeout': 30,
                'max_pages': 100,
                'crawl_depth': 3,
                'max_workers': 10
            }
        }

        # Load default config
        config = default_config

        # Load site-specific config if available
        site_config_path = os.path.join('configs', 'sites', f"{self.site_name}.yaml")
        if os.path.exists(site_config_path):
            with open(site_config_path, 'r') as f:
                site_config = yaml.safe_load(f)
                # Merge site config into general config (site overrides general)
                for key, value in site_config.items():
                    if key in config:
                        config[key].update(value)
                    else:
                        config[key] = value
        else:
            logger.warning(f"Site config not found for {self.site_name}, using defaults.")

        # Override with custom config if provided
        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                custom_config = yaml.safe_load(f)
                for key, value in custom_config.items():
                    if key in config:
                        config[key].update(value)
                    else:
                        config[key] = value

        return config

    def stop(self):
        """Request the scraper to stop."""
        self.stop_requested = True
        if hasattr(self, 'cv') and self.cv:
            with self.cv:
                self.cv.notify_all()

    def scrape(self, url: str) -> Optional[BeautifulSoup]:
        """
        Scrape a given URL for images.

        Args:
            url (str): The URL to scrape.

        Returns:
            Optional[BeautifulSoup]: The parsed HTML, or None if fetching failed.
        """
        if self.stop_requested:
            return None
        with self.lock:
            self.visited_urls.add(url)

        logger.info(f"Scraping {url}")
        try:
            response = self.session.get(url, timeout=self.config['general']['timeout'])
            response.raise_for_status()
        except requests.RequestException as e:
            logger.error(f"Failed to fetch {url}: {e}")
            return None

        soup = BeautifulSoup(response.content, 'lxml')
        self._extract_image_urls(soup, url)
        return soup

    def _extract_image_urls(self, soup: BeautifulSoup, base_url: str) -> None:
        """
        Extract image URLs from a BeautifulSoup object.

        Args:
            soup (BeautifulSoup): Parsed HTML.
            base_url (str): Base URL for resolving relative URLs.
        """
        # Find all img tags
        img_tags = soup.find_all('img')
        for img in img_tags:
            # 1. Try standard source attributes
            src_attr = img.get('src') or img.get('data-src') or img.get('data-original') or img.get('data-lazy')
            if src_attr:
                # Semicolon split for lazy loader attributes packing multiple URLs
                for raw_src in src_attr.split(';'):
                    raw_src = raw_src.strip()
                    if raw_src:
                        absolute_url = urljoin(base_url, raw_src)
                        if is_valid_url(absolute_url):
                            with self.lock:
                                self.image_urls.add(absolute_url)

            # 2. Try responsive srcset attributes
            srcset = img.get('srcset')
            if srcset:
                # srcset is comma-separated: "url1 width1, url2 width2"
                for part in srcset.split(','):
                    part = part.strip()
                    if part:
                        subparts = part.split()
                        if subparts:
                            img_url = subparts[0]
                            absolute_url = urljoin(base_url, img_url)
                            if is_valid_url(absolute_url):
                                with self.lock:
                                    self.image_urls.add(absolute_url)

        # Also look for images in CSS (optional, for future enhancement)
        # For now, we stick to img tags.

    def _extract_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """
        Extract internal links of the same domain from a parsed HTML page.

        Args:
            soup (BeautifulSoup): Parsed HTML.
            base_url (str): Base URL of the page.

        Returns:
            List[str]: List of internal absolute URLs.
        """
        links = []
        parsed_base = urlparse(base_url)
        base_domain = parsed_base.netloc

        for a in soup.find_all('a', href=True):
            href = a['href']
            abs_url = urljoin(base_url, href)
            normalized = normalize_url(abs_url)

            if not is_valid_url(normalized):
                continue

            parsed_url = urlparse(normalized)
            path = parsed_url.path.lower()

            # 1. Harvest direct image links regardless of domain
            if any(path.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp']):
                with self.lock:
                    self.image_urls.add(normalized)
                continue

            # 2. Page-crawling links must stay on the same domain
            if parsed_url.netloc != base_domain:
                continue

            # Avoid crawling non-HTML static files
            if any(path.endswith(ext) for ext in ['.gif', '.zip', '.pdf', '.mp4', '.mp3', '.avi', '.mov', '.tar', '.gz']):
                continue

            links.append(normalized)

        return links

    def run(self) -> None:
        """
        Run the scraper for the configured site, crawling multiple pages in parallel threads.
        """
        import threading
        
        base_url = self.config.get('site', {}).get('base_url', f"https://{self.site_name}.org/")
        logger.info(f"Starting parallel crawl for {self.site_name} at {base_url}")

        max_pages = self.config['general'].get('max_pages', 100)
        max_depth = self.config['general'].get('crawl_depth', 3)
        max_workers = self.config['general'].get('max_workers', 10)

        # BFS state
        self.visited_urls.clear()
        self.image_urls.clear()
        
        pages_scraped = 0
        active_workers = 0
        
        queued_urls = {base_url}
        url_queue = [(base_url, 0)]  # queue containing tuples (url, depth)
        
        state_lock = threading.Lock()
        self.cv = threading.Condition(state_lock)

        def worker_loop():
            nonlocal pages_scraped, active_workers
            
            while not self.stop_requested:
                current_url = None
                depth = 0
                
                with state_lock:
                    # Wait if queue is empty but other workers are still processing (might find more URLs)
                    while not url_queue and active_workers > 0 and not self.stop_requested:
                        if pages_scraped >= max_pages:
                            break
                        self.cv.wait()
                    
                    if self.stop_requested or pages_scraped >= max_pages:
                        break
                    
                    if not url_queue and active_workers == 0:
                        # Queue is empty and no workers are fetching -> crawl complete!
                        break
                    
                    current_url, depth = url_queue.pop(0)
                    self.visited_urls.add(current_url)
                    active_workers += 1
                
                # Fetch and parse page (outside lock to allow concurrency)
                soup = None
                try:
                    # Rate limit sleep (outside lock)
                    rate_limit = self.config['general'].get('rate_limit', 1.0)
                    if rate_limit > 0 and pages_scraped > 0:
                        import time
                        time.sleep(rate_limit)

                    soup = self.scrape(current_url)
                except Exception as e:
                    logger.error(f"Error fetching {current_url}: {e}")
                
                # Update queue and worker status
                with state_lock:
                    active_workers -= 1
                    if soup is not None:
                        pages_scraped += 1
                        
                        # Extract links if depth limit is not hit and page limit is not hit
                        if depth < max_depth and pages_scraped < max_pages:
                            extracted = self._extract_links(soup, current_url)
                            for link in extracted:
                                if link not in self.visited_urls and link not in queued_urls:
                                    queued_urls.add(link)
                                    url_queue.append((link, depth + 1))
                                    
                    # Notify other workers of status/queue changes
                    self.cv.notify_all()

        # Start worker threads
        threads = []
        num_threads = min(max_workers, max_pages)
        if num_threads < 1:
            num_threads = 1
            
        logger.info(f"Starting {num_threads} parallel crawl worker threads...")
        for _ in range(num_threads):
            t = threading.Thread(target=worker_loop)
            t.daemon = True
            t.start()
            threads.append(t)

        # Wait for all threads to complete
        for t in threads:
            t.join()

        # Reset condition variable reference
        with state_lock:
            self.cv = None

        if self.stop_requested:
            logger.info("Scraping stopped by user.")
            return

        logger.info(f"Finished crawling. Visited {pages_scraped} pages. Found {len(self.image_urls)} unique image URLs.")

        # Filter image URLs
        general_config = self.config['general']
        filtered_urls = filter_image_urls(
            self.image_urls,
            general_config['min_width'],
            general_config['min_height'],
            general_config['allowed_formats'],
            general_config['skip_keywords']
        )
        logger.info(f"After filtering, {len(filtered_urls)} image URLs remain.")

        # Download images
        downloader = ImageDownloader(
            download_dir=general_config['download_dir'],
            min_width=general_config['min_width'],
            min_height=general_config['min_height'],
            timeout=general_config['timeout'],
            rate_limit=general_config['rate_limit']
        )
        if self.stop_requested:
            logger.info("Scraping stopped before downloading.")
            return
        downloaded_count = downloader.download_images(filtered_urls, stop_checker=lambda: self.stop_requested)
        logger.info(f"Downloaded {downloaded_count} images.")