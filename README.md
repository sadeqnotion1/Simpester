# Fetch Wallpaper

A Python scraper for downloading high-quality images from websites, starting with https://margaretqualley.org/ and designed to be extensible to other sites.

## Features

- Scrapes websites for image URLs
- Filters out thumbnails and low-resolution images based on:
  - File extension (jpg, jpeg, png, webp)
  - URL keywords (thumb, thumbnail, small, lowres)
  - Minimum dimensions (configurable, default 800x600)
- Downloads images to a organized directory
- Rate limiting and polite scraping (respects robots.txt - TODO)
- Configurable via YAML files
- Extensible to other sites via site-specific configuration

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/fetch-wallpaper.git
   cd fetch-wallpaper
   ```

2. Install the dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

To scrape the default site (margaretqualley.org):

```
python main.py
```

To scrape a different site (if configured):

```
python main.py --site sitename
```

To use a custom configuration file:

```
python main.py --config /path/to/config.yaml
```

To enable verbose logging:

```
python main.py --verbose
```

## Configuration

### Default Configuration (`configs/default.yaml`)

```yaml
general:
  min_width: 800
  min_height: 600
  allowed_formats: [jpg, jpeg, png, webp]
  skip_keywords: [thumb, thumbnail, small, lowres]
  download_dir: ./downloads
  rate_limit: 1.0  # seconds between requests
  timeout: 30
```

### Site-Specific Configuration (`configs/sites/sitename.yaml`)

```yaml
site:
  name: sitename
  base_url: https://example.com/
  selectors:
    - "img[src]"
    - "img[data-src]"
  pagination:
    next_selector: null
    base_url: null
```

## Extending to Other Sites

To add support for a new site:
1. Create a site-specific YAML file in `configs/sites/` (e.g., `configs/sites/newsitename.yaml`).
2. Adjust the selectors and pagination settings as needed for the site's structure.
3. Run the scraper with `--site newsitename`.

## Requirements

- Python 3.7+
- Dependencies listed in `requirements.txt`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This tool is for educational purposes only. Users are responsible for ensuring they have the right to download and use any images retrieved by this tool. Always respect the website's terms of service and copyright laws.