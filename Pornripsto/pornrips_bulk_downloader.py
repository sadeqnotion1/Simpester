import os
import re
import sys
import urllib.request
import urllib.error
import time

# Reconfigure stdout to support UTF-8 characters on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import threading
import concurrent.futures
import hashlib
import urllib.parse

# Thread-safe print wrapper for concurrent logging
print_lock = threading.Lock()
_print = print
def print(*args, **kwargs):
    with print_lock:
        _print(*args, **kwargs)

# Studio names/prefixes to exclude from downloading (case-insensitive)
EXCLUDED_COMPANIES = ['AuntJudys', 'AllOver30']

# Custom headers to bypass security checks
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def sanitize_filename(name):
    return re.sub(r'[<>:"/\\|?*]', '_', name)

def torrent_to_magnet(torrent_bytes):
    try:
        def parse_item(data, index):
            char = data[index:index+1]
            if char == b'i':
                end = data.index(b'e', index)
                val = int(data[index+1:end])
                return val, end + 1
            elif char == b'l':
                index += 1
                lst = []
                while data[index:index+1] != b'e':
                    val, index = parse_item(data, index)
                    lst.append(val)
                return lst, index + 1
            elif char == b'd':
                index += 1
                dct = {}
                while data[index:index+1] != b'e':
                    key, index = parse_item(data, index)
                    val, index = parse_item(data, index)
                    dct[key] = val
                return dct, index + 1
            elif char.isdigit():
                colon = data.index(b':', index)
                length = int(data[index:colon])
                start = colon + 1
                end = start + length
                val = data[start:end]
                return val, end
            else:
                raise ValueError("Invalid bencode")

        def bencode(data):
            if isinstance(data, bytes):
                return bytes(str(len(data)), 'ascii') + b':' + data
            elif isinstance(data, str):
                b = data.encode('utf-8')
                return bytes(str(len(b)), 'ascii') + b':' + b
            elif isinstance(data, int):
                return b'i' + bytes(str(data), 'ascii') + b'e'
            elif isinstance(data, list):
                return b'l' + b''.join(bencode(x) for x in data) + b'e'
            elif isinstance(data, dict):
                sorted_keys = sorted(data.keys())
                parts = []
                for k in sorted_keys:
                    parts.append(bencode(k))
                    parts.append(bencode(data[k]))
                return b'd' + b''.join(parts) + b'e'
            raise TypeError(f"Cannot bencode {type(data)}")

        decoded, _ = parse_item(torrent_bytes, 0)
        if not isinstance(decoded, dict) or b'info' not in decoded:
            return None
            
        info_bytes = bencode(decoded[b'info'])
        info_hash = hashlib.sha1(info_bytes).hexdigest()
        
        name_bytes = decoded[b'info'].get(b'name', b'unknown')
        name_str = name_bytes.decode('utf-8', errors='ignore')
        
        trackers = []
        if b'announce' in decoded:
            trackers.append(decoded[b'announce'].decode('utf-8', errors='ignore'))
        if b'announce-list' in decoded:
            for group in decoded[b'announce-list']:
                if isinstance(group, list):
                    for t in group:
                        if isinstance(t, bytes):
                            trackers.append(t.decode('utf-8', errors='ignore'))
                            
        seen = set()
        unique_trackers = [x for x in trackers if not (x in seen or seen.add(x))]
        
        tr_param = "".join(f"&tr={urllib.parse.quote(t)}" for t in unique_trackers)
        return f"magnet:?xt=urn:btih:{info_hash}&dn={urllib.parse.quote(name_str)}{tr_param}"
    except Exception as e:
        print(f"Error parsing torrent to magnet: {e}")
        return None

def fetch_url(url, referer=None):
    headers = HEADERS.copy()
    if referer:
        headers['Referer'] = referer
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.read()
    except urllib.error.HTTPError as e:
        print(f"  [HTTP Error] {e.code} for {url}")
    except Exception as e:
        print(f"  [Error] {str(e)} for {url}")
    return None

def scrape_date_page(date_str, excluded_companies=None):
    # Normalize date string YYYY-MM-DD or YYYY/MM/DD to YYYY/MM/DD
    date_normalized = date_str.replace('-', '/').strip('/')
    base_url = f"https://pornrips.to/{date_normalized}/"
    
    print(f"\n🔍 Scanning PornRips date index: {base_url}")
    
    matched_posts = []
    page = 1
    
    while page <= 10:
        url = base_url if page == 1 else f"{base_url}page/{page}/"
        print(f"  Crawling index page {page}...")
        
        html_bytes = fetch_url(url)
        if not html_bytes:
            break
            
        html = html_bytes.decode('utf-8', errors='ignore')
        
        # Regex to find post articles with titles and URLs
        # Format: <h2 class="entry-title"><a href="https://pornrips.to/.../" rel="bookmark">...</a></h2>
        matches = re.findall(r'<h2 class=["\']?entry-title["\']?><a\s+[^>]*href=["\']?([^"\'\s>]+)["\']?[^>]*>([^<]+)</a>', html)
        
        if not matches:
            # Try alternate pattern
            matches = re.findall(r'<a\s+[^>]*href=["\']?([^"\'\s>]+)["\']?\s+rel=["\']?bookmark["\']?>([^<]+)</a>', html)
            
        if not matches:
            print("  No articles found. Ending index scan.")
            break
            
        page_matches = 0
        for href, title in matches:
            title = title.strip()
            if '1080p' in title.lower():
                # Check exclusion list (case-insensitive prefix match)
                is_excluded = False
                if excluded_companies:
                    for company in excluded_companies:
                        if title.lower().startswith(company.lower().strip()):
                            is_excluded = True
                            break
                if is_excluded:
                    print(f"    Skipping excluded studio post: {title}")
                    continue
                    
                matched_posts.append({
                    'title': title,
                    'url': href
                })
                page_matches += 1
                
        print(f"    Resolved {page_matches} matching 1080p posts on page {page}.")
        
        # Look for next page links to verify pagination existence
        if f"/page/{page + 1}/" not in html and f"/{date_normalized}/page/{page + 1}/" not in html:
            break
            
        page += 1
        time.sleep(0.5)
        
    return matched_posts, date_normalized

def scrape_movie_details(post):
    print(f"\n📂 Scraping details for: {post['title']}")
    html_bytes = fetch_url(post['url'])
    if not html_bytes:
        return None
        
    html = html_bytes.decode('utf-8', errors='ignore')
    
    # 1. Resolve torrent link
    torrent_match = re.search(r'href=["\']?([^"\'\s>]+\.torrent)["\']?', html)
    torrent_url = torrent_match.group(1) if torrent_match else None
    
    # 2. Resolve screenshots
    # Look for Pixhost links and thumbnails inside content
    screenshots = []
    
    # Extract all pixhost link hrefs
    pixhost_links = re.findall(r'<a\s+[^>]*href=["\']?([^"\'\s]*pixhost\.to/show/[^"\'\s>]+)["\']?', html)
    
    # Also find corresponding thumbnails to extract exact server
    thumbs = re.findall(r'src=["\']?([^"\'\s]*pixhost\.to/thumbs/([^"\'\s>]+))["\']?', html)
    
    for idx, show_url in enumerate(pixhost_links):
        # Convert thumb to full URL if possible, otherwise construct fallback
        # Thumb pattern: https://t[SERVER].pixhost.to/thumbs/[FOLDER]/[FILE]
        # Full pattern: https://img[SERVER].pixhost.to/images/[FOLDER]/[FILE]
        full_url = None
        thumb_url = None
        
        # Try to align thumbnail
        # Pixhost show pattern: https://pixhost.to/show/[FOLDER]/[FILE]
        show_match = re.search(r'pixhost\.to/show/(\d+)/(.+)', show_url)
        if show_match:
            folder, filename = show_match.group(1), show_match.group(2)
            
            # Find a matching thumbnail URL for this folder/file to extract the server number
            for thumb_src, path in thumbs:
                if f"{folder}/{filename}" in path:
                    thumb_url = thumb_src
                    server_match = re.search(r't(\d+)\.pixhost\.to', thumb_src)
                    if server_match:
                        server = server_match.group(1)
                        full_url = f"https://img{server}.pixhost.to/images/{folder}/{filename}"
                        break
            
            # Fallback if no thumbnail server matches
            if not full_url:
                full_url = f"https://img1.pixhost.to/images/{folder}/{filename}"
                
        screenshots.append({
            'index': idx + 1,
            'show_page_url': show_url,
            'thumb_url': thumb_url,
            'full_url': full_url
        })
        
    return {
        'torrent_url': torrent_url,
        'screenshots': screenshots
    }

def main():
    print("=" * 60)
    print("🎬 PornRips Standalone Bulk Downloader (1080p Only) 🎬")
    print("=" * 60)
    
    # Check command-line arguments for date
    if len(sys.argv) > 1:
        date_input = sys.argv[1].strip()
        print(f"Using date from command-line: {date_input}")
    else:
        # Ask for date
        default_date = time.strftime("%Y/%m/%d")
        date_input = input(f"Enter date (e.g. YYYY/MM/DD or YYYY-MM-DD) [{default_date}]: ").strip()
        if not date_input:
            date_input = default_date
        
    posts, date_path = scrape_date_page(date_input, EXCLUDED_COMPANIES)
    
    if not posts:
        print("\n❌ No 1080p videos found for this date. Exiting.")
        return
        
    output_dir = os.getcwd()
    date_folder = os.path.join(output_dir, f"PornRips_{date_path.replace('/', '_')}")
    print(f"\n📦 Found {len(posts)} videos. Downloading directly into: {date_folder}...")
    
    # Parallel download with ThreadPoolExecutor (5x Speed)
    stats = {
        'total_downloaded': 0,
        'total_files': 0,
        'index': 0
    }
    stats_lock = threading.Lock()
    magnet_links = []
    magnet_lock = threading.Lock()
    total_posts = len(posts)
    
    def download_movie_worker(post):
        try:
            movie_dir = sanitize_filename(post['title'])
            movie_dir_path = os.path.join(date_folder, movie_dir)
            os.makedirs(movie_dir_path, exist_ok=True)
            
            with stats_lock:
                stats['index'] += 1
                current_idx = stats['index']
                
            print(f"\n[{current_idx}/{total_posts}] Processing: {post['title']}")
            
            details = scrape_movie_details(post)
            if not details:
                return
                
            # 1. Download Torrent File
            if details['torrent_url']:
                print(f"  📥 Fetching torrent for: {post['title']}...")
                torrent_data = fetch_url(details['torrent_url'])
                if torrent_data:
                    torrent_file_path = os.path.join(movie_dir_path, f"{movie_dir}.torrent")
                    with open(torrent_file_path, "wb") as f:
                        f.write(torrent_data)
                    with stats_lock:
                        stats['total_downloaded'] += len(torrent_data)
                        stats['total_files'] += 1
                    print(f"  ✅ Torrent added for: {post['title']}")
                    
                    # Convert to magnet link
                    magnet = torrent_to_magnet(torrent_data)
                    if magnet:
                        with magnet_lock:
                            magnet_links.append((post['title'], magnet))
                else:
                    print(f"  ❌ Failed to download torrent for: {post['title']}")
            
            # 2. Download screenshots (Spoofing referrer to bypass hotlink protection!)
            if details['screenshots']:
                print(f"  📥 Fetching {len(details['screenshots'])} screenshots for: {post['title']}...")
                for img in details['screenshots']:
                    if not img['full_url']:
                        continue
                    
                    img_data = fetch_url(img['full_url'], referer=img['show_page_url'])
                    
                    if img_data:
                        if len(img_data) < 15000:
                            print(f"    ⚠️ Warning: Screenshot #{img['index']} for {post['title']} returned small file ({len(img_data)/1024:.1f} KB). Hotlink blocked?")
                        
                        img_file_path = os.path.join(movie_dir_path, f"{movie_dir}_{img['index']}.jpg")
                        with open(img_file_path, "wb") as f:
                            f.write(img_data)
                        with stats_lock:
                            stats['total_downloaded'] += len(img_data)
                            stats['total_files'] += 1
                    else:
                        print(f"    ❌ Failed to download screenshot #{img['index']} for: {post['title']}")
                    
                    time.sleep(0.3)  # Respectful sleep
                    
            time.sleep(0.5)
        except Exception as ex:
            print(f"Error processing {post['title']}: {str(ex)}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(download_movie_worker, post) for post in posts]
        concurrent.futures.wait(futures)
        
    # Write magnets.txt file
    if magnet_links:
        magnet_links.sort()
        magnets_path = os.path.join(date_folder, "magnets.txt")
        with open(magnets_path, "w", encoding="utf-8") as mag_file:
            for title, mag in magnet_links:
                mag_file.write(f"Title: {title}\nMagnet: {mag}\n\n")
        print("✓ Saved magnet links to magnets.txt.")
        
    print("\n" + "=" * 60)
    print(f"🎉 Export Complete! Saved to: {date_folder}")
    print(f"📊 Stats: Downloaded {stats['total_files']} files | Total size: {stats['total_downloaded'] / (1024*1024):.2f} MB")
    print("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n👋 Script stopped by user.")
        sys.exit(0)
