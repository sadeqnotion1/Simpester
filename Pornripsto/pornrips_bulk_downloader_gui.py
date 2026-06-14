import os
import re
import sys
import urllib.request
import urllib.error
import time
import threading
import concurrent.futures
import hashlib
import urllib.parse
import tkinter as tk
from tkinter import ttk, filedialog
import json

# Reconfigure stdout to support UTF-8 characters on Windows consoles
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Custom headers to bypass security checks
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

def sanitize_filename(name):
    return re.sub(r'[<>:"/\\|?*]', '_', name)

class PornRipsGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("PornRips Bulk Downloader (1080p Only)")
        self.root.geometry("680x620")
        self.root.minsize(600, 550)
        
        # Apply dark theme styles
        self.setup_styles()
        
        # Load config
        self.config = self.load_config()
        
        # State variables
        self.is_running = False
        self.downloaded_bytes = 0
        self.total_files = 0
        self.matched_posts = []
        self.date_path = ""
        
        # Setup advanced filtering variables
        self.scan_dir_var = tk.StringVar(value=self.config["scan_dir"])
        self.advanced_filter_mode = tk.StringVar(value=self.config["advanced_filter_mode"])
        
        self.studio_vars = {}
        for studio in self.config["selected_studios"]:
            self.studio_vars[studio] = tk.BooleanVar(value=True)
        
        # Build UI
        self.create_widgets()
        
        # Set default values from config
        self.date_var.set(self.config["date"])
        self.dir_var.set(self.config["output_dir"])
        self.exclude_var.set(self.config["exclude_studios"])
        
        # Update advanced filter label status
        self.update_status_lbl()
        
        self.log_message("System initialized. Enter a date and click 'Start Bulk Download'.", "info")

    def setup_styles(self):
        self.bg_dark = "#0f0f15"
        self.bg_card = "#161621"
        self.border_color = "#2a2a35"
        self.text_main = "#f1f5f9"
        self.text_muted = "#94a3b8"
        self.accent_color = "#6366f1"
        self.success_color = "#10b981"
        self.warning_color = "#fbbf24"
        self.error_color = "#f43f5e"

        self.root.configure(bg=self.bg_dark)

        # Style ttk widgets
        self.style = ttk.Style()
        self.style.theme_use('default')
        
        # Progressbar styling
        self.style.configure(
            "Custom.Horizontal.TProgressbar",
            troughcolor=self.bg_dark,
            background=self.accent_color,
            thickness=8,
            borderwidth=0
        )

    def create_widgets(self):
        # Top Header Card
        header_frame = tk.Frame(self.root, bg=self.bg_card, highlightbackground=self.border_color, highlightthickness=1)
        header_frame.pack(fill="x", padx=16, pady=16)
        
        logo_lbl = tk.Label(header_frame, text="⚡", font=("Segoe UI", 18), bg=self.bg_card, fg=self.accent_color)
        logo_lbl.pack(side="left", padx=(16, 8), pady=12)
        
        title_lbl = tk.Label(header_frame, text="PornRips Bulk Downloader", font=("Segoe UI", 16, "bold"), bg=self.bg_card, fg=self.text_main)
        title_lbl.pack(side="left", pady=12)

        # Main Workspace: 2-column or grid layout
        workspace_frame = tk.Frame(self.root, bg=self.bg_dark)
        workspace_frame.pack(fill="both", expand=True, padx=16)

        # Config Panel (Top Section)
        config_frame = tk.LabelFrame(workspace_frame, text=" CONFIGURATION ", font=("Segoe UI", 9, "bold"), 
                                     bg=self.bg_dark, fg=self.accent_color, highlightbackground=self.border_color, highlightthickness=1)
        config_frame.pack(fill="x", pady=(0, 12), ipady=8)

        # Date input row
        date_lbl = tk.Label(config_frame, text="Target Date:", font=("Segoe UI", 10, "bold"), bg=self.bg_dark, fg=self.text_muted)
        date_lbl.grid(row=0, column=0, sticky="w", padx=16, pady=8)
        
        self.date_var = tk.StringVar()
        self.date_entry = tk.Entry(config_frame, textvariable=self.date_var, font=("Segoe UI", 10), bg="#050508", fg=self.text_main, 
                                   insertbackground=self.text_main, borderwidth=1, relief="solid", width=18)
        self.date_entry.grid(row=0, column=1, sticky="w", padx=(0, 16), pady=8)

        # Output directory row
        dir_lbl = tk.Label(config_frame, text="Output Directory:", font=("Segoe UI", 10, "bold"), bg=self.bg_dark, fg=self.text_muted)
        dir_lbl.grid(row=2, column=0, sticky="w", padx=16, pady=8)
        
        self.dir_var = tk.StringVar()
        self.dir_entry = tk.Entry(config_frame, textvariable=self.dir_var, font=("Segoe UI", 10), bg="#050508", fg=self.text_main,
                                  borderwidth=1, relief="solid", width=35)
        self.dir_entry.grid(row=2, column=1, sticky="ew", padx=(0, 8), pady=8)
        
        self.btn_browse = tk.Button(config_frame, text="Browse...", font=("Segoe UI", 9, "bold"), bg=self.bg_card, fg=self.text_main,
                                    activebackground="#1e1e2f", activeforeground=self.text_main, borderwidth=1, relief="flat", command=self.browse_directory)
        self.btn_browse.grid(row=2, column=2, sticky="e", padx=(0, 16), pady=8)

        # Excluded studio prefix list row
        exclude_lbl = tk.Label(config_frame, text="Exclude Studios:", font=("Segoe UI", 10, "bold"), bg=self.bg_dark, fg=self.text_muted)
        exclude_lbl.grid(row=1, column=0, sticky="w", padx=16, pady=8)
        
        self.exclude_var = tk.StringVar()
        self.exclude_var.set("AuntJudys, AllOver30")
        self.exclude_entry = tk.Entry(config_frame, textvariable=self.exclude_var, font=("Segoe UI", 10), bg="#050508", fg=self.text_main,
                                     insertbackground=self.text_main, borderwidth=1, relief="solid", width=35)
        self.exclude_entry.grid(row=1, column=1, sticky="ew", padx=(0, 16), pady=8)

        # Advanced filter status row
        adv_lbl = tk.Label(config_frame, text="Advanced Filter:", font=("Segoe UI", 10, "bold"), bg=self.bg_dark, fg=self.text_muted)
        adv_lbl.grid(row=3, column=0, sticky="w", padx=16, pady=8)
        
        self.adv_status_lbl = tk.Label(config_frame, text="Disabled", font=("Segoe UI", 10), bg=self.bg_dark, fg=self.text_muted)
        self.adv_status_lbl.grid(row=3, column=1, sticky="w", padx=(0, 16), pady=8)
        
        self.btn_advanced = tk.Button(config_frame, text="⚙️ Advanced...", font=("Segoe UI", 9, "bold"), bg=self.bg_card, fg=self.text_main,
                                      activebackground="#1e1e2f", activeforeground=self.text_main, borderwidth=1, relief="flat", command=self.open_advanced_filter)
        self.btn_advanced.grid(row=3, column=2, sticky="e", padx=(0, 16), pady=8)

        config_frame.columnconfigure(1, weight=1)

        # Control Panel (Buttons and Progress)
        control_frame = tk.Frame(workspace_frame, bg=self.bg_dark)
        control_frame.pack(fill="x", pady=(0, 12))

        self.btn_start = tk.Button(control_frame, text="🚀 Start Bulk Download", font=("Segoe UI", 11, "bold"), bg=self.accent_color, fg=self.text_main,
                                   activebackground="#4f46e5", activeforeground=self.text_main, borderwidth=0, relief="flat", height=2, command=self.start_scraping)
        self.btn_start.pack(fill="x", pady=(0, 8))

        # Progress bar
        self.progress_bar = ttk.Progressbar(control_frame, style="Custom.Horizontal.TProgressbar", mode="determinate")
        self.progress_bar.pack(fill="x", pady=4)
        
        self.progress_lbl = tk.Label(control_frame, text="Idle", font=("Segoe UI", 9), bg=self.bg_dark, fg=self.text_muted)
        self.progress_lbl.pack(side="left", pady=2)
        
        self.percent_lbl = tk.Label(control_frame, text="0%", font=("Segoe UI", 9, "bold"), bg=self.bg_dark, fg=self.text_main)
        self.percent_lbl.pack(side="right", pady=2)

        # Console Log Panel (Fills remaining height)
        log_frame = tk.LabelFrame(workspace_frame, text=" CONSOLE SYSTEM LOGS ", font=("Segoe UI", 9, "bold"), 
                                  bg=self.bg_dark, fg=self.accent_color, highlightbackground=self.border_color, highlightthickness=1)
        log_frame.pack(fill="both", expand=True)

        scrollbar = tk.Scrollbar(log_frame)
        scrollbar.pack(side="right", fill="y", pady=8)

        self.log_text = tk.Text(log_frame, font=("Consolas", 10), bg="#040407", fg="#34d399", borderwidth=0,
                                yscrollcommand=scrollbar.set, state="disabled", highlightthickness=0)
        self.log_text.pack(fill="both", expand=True, padx=8, pady=8)
        scrollbar.config(command=self.log_text.yview)

    def browse_directory(self):
        selected_dir = filedialog.askdirectory(initialdir=self.dir_var.get())
        if selected_dir:
            self.dir_var.set(selected_dir)

    def log_message(self, message, type="info"):
        # Map log types to color tags
        colors = {
            "info": "#60a5fa",      # Blue
            "success": "#34d399",   # Green
            "warn": "#fbbf24",      # Yellow
            "err": "#f87171"        # Red
        }
        color = colors.get(type, "#f1f5f9")
        timestamp = time.strftime("%H:%M:%S")
        full_line = f"[{timestamp}] {message}\n"
        
        def write_to_text():
            self.log_text.config(state="normal")
            
            # Insert log and apply color tag
            tag_name = f"tag_{type}"
            self.log_text.tag_config(tag_name, foreground=color)
            self.log_text.insert("end", full_line, tag_name)
            
            self.log_text.config(state="disabled")
            self.log_text.see("end")

        # Ensure UI updates are threaded safely
        self.root.after(0, write_to_text)

    def update_progress(self, percent, label):
        def write_progress():
            self.progress_bar["value"] = percent
            self.percent_lbl.configure(text=f"{percent}%")
            self.progress_lbl.configure(text=label)
        self.root.after(0, write_progress)

    def start_scraping(self):
        if self.is_running:
            return
            
        date_str = self.date_var.get().strip()
        output_dir = self.dir_var.get().strip()
        
        # Validation checks
        if not re.match(r'^\d{4}[\/\-]\d{2}[\/\-]\d{2}$', date_str):
            self.log_message("Error: Target date must match format YYYY/MM/DD or YYYY-MM-DD", "err")
            return
            
        if not os.path.isdir(output_dir):
            self.log_message("Error: Output directory path is invalid.", "err")
            return

        self.is_running = True
        self.btn_start.config(state="disabled", text="Processing Download...", bg="#374151")
        self.date_entry.config(state="disabled")
        self.exclude_entry.config(state="disabled")
        self.dir_entry.config(state="disabled")
        self.btn_browse.config(state="disabled")
        self.btn_advanced.config(state="disabled")
        
        exclusions = [x.strip() for x in self.exclude_var.get().split(',') if x.strip()]
        
        # Save config when starting scraper to remember fields
        self.save_config()
        
        # Launch crawler in background thread
        threading.Thread(target=self.crawler_thread, args=(date_str, output_dir, exclusions), daemon=True).start()

    def fetch_url_data(self, url, referer=None):
        headers = HEADERS.copy()
        if referer:
            headers['Referer'] = referer
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                return response.read()
        except urllib.error.HTTPError as e:
            self.log_message(f"HTTP Error {e.code} fetching: {url}", "err")
        except Exception as e:
            self.log_message(f"Network error fetching {url}: {str(e)}", "err")
        return None

    def crawler_thread(self, date_str, output_dir, exclusions):
        # 1. Start Scrape date index
        date_normalized = date_str.replace('-', '/').strip('/')
        base_url = f"https://pornrips.to/{date_normalized}/"
        
        self.log_message(f"Scanning PornRips date index: {base_url}", "info")
        self.update_progress(5, "Scanning page index...")
        
        matched_posts = []
        page = 1
        
        while page <= 10:
            url = base_url if page == 1 else f"{base_url}page/{page}/"
            self.log_message(f"Crawling page index {page}...", "info")
            
            html_bytes = self.fetch_url_data(url)
            if not html_bytes:
                break
                
            html = html_bytes.decode('utf-8', errors='ignore')
            
            matches = re.findall(r'<h2 class=["\']?entry-title["\']?><a\s+[^>]*href=["\']?([^"\'\s>]+)["\']?[^>]*>([^<]+)</a>', html)
            if not matches:
                matches = re.findall(r'<a\s+[^>]*href=["\']?([^"\'\s>]+)["\']?\s+rel=["\']?bookmark["\']?>([^<]+)</a>', html)
                
            if not matches:
                self.log_message("End of index search.", "info")
                break
                
            page_matches = 0
            for href, title in matches:
                title = title.strip()
                if '1080p' in title.lower():
                    # Check exclusion list (case-insensitive prefix match)
                    is_excluded = False
                    for company in exclusions:
                        if title.lower().startswith(company.lower().strip()):
                            is_excluded = True
                            break
                    if is_excluded:
                        self.log_message(f"Skipping excluded studio post (basic): {title}", "warn")
                        continue
                        
                    # Advanced Filter check
                    adv_mode = self.advanced_filter_mode.get()
                    checked_studios = [s for s, var in self.studio_vars.items() if var.get()]
                    
                    if adv_mode == "Exclude":
                        for s in checked_studios:
                            if title.lower().startswith(s.lower()):
                                is_excluded = True
                                break
                        if is_excluded:
                            self.log_message(f"Skipping excluded studio post (advanced blacklist): {title}", "warn")
                            continue
                    elif adv_mode == "Include":
                        is_included = False
                        for s in checked_studios:
                            if title.lower().startswith(s.lower()):
                                is_included = True
                                break
                        if not is_included:
                            self.log_message(f"Skipping non-included studio post (advanced whitelist): {title}", "warn")
                            continue
                        
                    matched_posts.append({'title': title, 'url': href})
                    page_matches += 1
                    
            self.log_message(f"Resolved {page_matches} matching 1080p videos on page {page}.", "success")
            
            if f"/page/{page + 1}/" not in html and f"/{date_normalized}/page/{page + 1}/" not in html:
                break
                
            page += 1
            time.sleep(0.4)

        if not matched_posts:
            self.log_message("No matching 1080p videos found on this date.", "warn")
            self.update_progress(0, "Crawl aborted - No videos.")
            self.reset_controls()
            return
            
        # 2. Scrape Details & Download Direct Folders
        date_folder = os.path.join(output_dir, f"PornRips_{date_normalized.replace('/', '_')}")
        self.log_message(f"Found {len(matched_posts)} videos. Downloading directly into: {date_folder}", "info")
        
        self.downloaded_bytes = 0
        self.total_files = 0
        self.magnet_links = []
        self.magnet_lock = threading.Lock()
        
        try:
            os.makedirs(date_folder, exist_ok=True)
            
            # Add index file
            info_content = f"PornRips 1080p Export\nDate: {date_normalized}\nTotal Videos: {len(matched_posts)}\n"
            with open(os.path.join(date_folder, "info.txt"), "w", encoding="utf-8") as info_file:
                info_file.write(info_content)
                
            # Parallel download with ThreadPoolExecutor (5x Speed)
            completed_lock = threading.Lock()
            progress_state = {'count': 0}
            total_posts = len(matched_posts)
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                futures = [
                    executor.submit(
                        self.download_movie_worker,
                        post,
                        date_folder,
                        completed_lock,
                        progress_state,
                        total_posts
                    )
                    for post in matched_posts
                ]
                concurrent.futures.wait(futures)
                
            # Write magnets.txt file
            if self.magnet_links:
                self.magnet_links.sort()
                magnets_path = os.path.join(date_folder, "magnets.txt")
                with open(magnets_path, "w", encoding="utf-8") as mag_file:
                    for title, mag in self.magnet_links:
                        mag_file.write(f"Title: {title}\nMagnet: {mag}\n\n")
                self.log_message("✓ Saved magnet links to magnets.txt.", "success")
                
            self.log_message("All downloads completed successfully!", "success")
            self.log_message(f"Folder directory: {date_folder}", "success")
            self.log_message(f"Stats: Downloaded {self.total_files} files | Total size: {self.downloaded_bytes / (1024*1024):.2f} MB", "success")
            self.update_progress(100, "Download Complete!")
            
        except Exception as e:
            self.log_message(f"Error downloading files: {str(e)}", "err")
            self.update_progress(0, "Failed with error.")
            
        self.reset_controls()

    def reset_controls(self):
        self.is_running = False
        def write_reset():
            self.btn_start.config(state="normal", text="🚀 Start Bulk Download", bg=self.accent_color)
            self.date_entry.config(state="normal")
            self.exclude_entry.config(state="normal")
            self.dir_entry.config(state="normal")
            self.btn_browse.config(state="normal")
            self.btn_advanced.config(state="normal")
        self.root.after(0, write_reset)

    def download_movie_worker(self, post, date_folder, completed_lock, progress_state, total_posts):
        try:
            movie_dir = sanitize_filename(post['title'])
            movie_dir_path = os.path.join(date_folder, movie_dir)
            os.makedirs(movie_dir_path, exist_ok=True)
            
            self.log_message(f"Scraping details: {post['title']}", "info")
            
            # Fetch movie page html
            details_html = self.fetch_url_data(post['url'])
            if not details_html:
                self.log_message(f"Failed loading details page for: {post['title']}", "err")
                with completed_lock:
                    progress_state['count'] += 1
                    percent = 10 + int((progress_state['count'] / total_posts) * 90)
                    self.update_progress(percent, f"Processed {progress_state['count']}/{total_posts}: {post['title']}")
                return
                
            html = details_html.decode('utf-8', errors='ignore')
            
            # Resolve torrent
            torrent_match = re.search(r'href=["\']?([^"\'\s>]+\.torrent)["\']?', html)
            if torrent_match:
                torrent_url = torrent_match.group(1)
                self.log_message(f"  Fetching torrent file: {torrent_url}", "info")
                torrent_data = self.fetch_url_data(torrent_url)
                if torrent_data:
                    torrent_file_path = os.path.join(movie_dir_path, f"{movie_dir}.torrent")
                    with open(torrent_file_path, "wb") as f:
                        f.write(torrent_data)
                    with completed_lock:
                        self.downloaded_bytes += len(torrent_data)
                        self.total_files += 1
                    self.log_message(f"  ✓ Torrent added: {post['title']}", "success")
                    
                    # Convert to magnet link
                    magnet = self.torrent_to_magnet(torrent_data)
                    if magnet:
                        with self.magnet_lock:
                            self.magnet_links.append((post['title'], magnet))
                else:
                    self.log_message(f"  ✗ Torrent download failed: {post['title']}", "err")
            
            # Resolve screenshots
            pixhost_links = re.findall(r'<a\s+[^>]*href=["\']?([^"\'\s]*pixhost\.to/show/[^"\'\s>]+)["\']?', html)
            thumbs = re.findall(r'src=["\']?([^"\'\s]*pixhost\.to/thumbs/([^"\'\s>]+))["\']?', html)
            
            if pixhost_links:
                self.log_message(f"  Downloading {len(pixhost_links)} screenshots for: {post['title']}", "info")
                for s_idx, show_url in enumerate(pixhost_links):
                    full_url = None
                    
                    # Parse server from thumb
                    show_match = re.search(r'pixhost\.to/show/(\d+)/(.+)', show_url)
                    if show_match:
                        folder, filename = show_match.group(1), show_match.group(2)
                        for thumb_src, path in thumbs:
                            if f"{folder}/{filename}" in path:
                                server_match = re.search(r't(\d+)\.pixhost\.to', thumb_src)
                                if server_match:
                                    full_url = f"https://img{server_match.group(1)}.pixhost.to/images/{folder}/{filename}"
                                    break
                        if not full_url:
                            full_url = f"https://img1.pixhost.to/images/{folder}/{filename}"
                    
                    if full_url:
                        # Fetch image with show page URL as referrer to bypass hotlink block!
                        img_data = self.fetch_url_data(full_url, referer=show_url)
                        if img_data:
                            if len(img_data) < 15000:
                                self.log_message(f"    ⚠️ Warning: Screenshot #{s_idx+1} for {post['title']} is small ({len(img_data)/1024:.1f} KB). Block placeholder?", "warn")
                            
                            img_file_path = os.path.join(movie_dir_path, f"{movie_dir}_{s_idx+1}.jpg")
                            with open(img_file_path, "wb") as f:
                                f.write(img_data)
                            with completed_lock:
                                self.downloaded_bytes += len(img_data)
                                self.total_files += 1
                        else:
                            self.log_message(f"    ✗ Screenshot #{s_idx+1} failed for: {post['title']}", "err")
                            
                    time.sleep(0.3) # Avoid spamming CDN
                    
            time.sleep(0.4)
            
            with completed_lock:
                progress_state['count'] += 1
                percent = 10 + int((progress_state['count'] / total_posts) * 90)
                self.update_progress(percent, f"Processed {progress_state['count']}/{total_posts}: {post['title']}")
        except Exception as ex:
            self.log_message(f"Error downloading {post['title']}: {str(ex)}", "err")

    def torrent_to_magnet(self, torrent_bytes):
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
            self.log_message(f"Error parsing torrent to magnet: {e}", "err")
            return None

    def load_config(self):
        default_config = {
            "date": time.strftime("%Y/%m/%d"),
            "output_dir": os.getcwd(),
            "exclude_studios": "AuntJudys, AllOver30",
            "scan_dir": r"C:\Users\SadeQ\Videos\xxx\PornRips_2026_05_31",
            "advanced_filter_mode": "Disabled",
            "selected_studios": []
        }
        config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gui_config.json")
        if os.path.exists(config_file):
            try:
                with open(config_file, "r", encoding="utf-8") as f:
                    config = json.load(f)
                    for k, v in default_config.items():
                        if k not in config:
                            config[k] = v
                    return config
            except Exception as e:
                print(f"Error loading config: {e}")
        return default_config

    def save_config(self):
        config = {
            "date": self.date_var.get(),
            "output_dir": self.dir_var.get(),
            "exclude_studios": self.exclude_var.get(),
            "scan_dir": self.scan_dir_var.get(),
            "advanced_filter_mode": self.advanced_filter_mode.get(),
            "selected_studios": [studio for studio, var in self.studio_vars.items() if var.get()]
        }
        config_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gui_config.json")
        try:
            with open(config_file, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=4)
        except Exception as e:
            print(f"Error saving config: {e}")

    def scan_studios(self):
        path = self.scan_dir_var.get().strip()
        if not path or not os.path.exists(path):
            return []
        
        studios = set()
        try:
            for entry in os.scandir(path):
                if entry.is_dir():
                    name = entry.name
                    match = re.search(r'\.\d{2,4}\.\d{2}\.\d{2}\.', name)
                    if match:
                        studio = name[:match.start()]
                    else:
                        studio = name.split('.')[0]
                    studio = studio.strip()
                    if studio:
                        studios.add(studio)
        except Exception as e:
            self.log_message(f"Error scanning directories: {e}", "err")
            return []
            
        sorted_studios = sorted(list(studios), key=str.lower)
        
        for s in sorted_studios:
            if s not in self.studio_vars:
                self.studio_vars[s] = tk.BooleanVar(value=False)
                
        return sorted_studios

    def update_status_lbl(self):
        mode = self.advanced_filter_mode.get()
        if mode == "Disabled":
            self.adv_status_lbl.config(text="Disabled (using basic exclusion text)", fg=self.text_muted)
        elif mode == "Exclude":
            selected_count = sum(1 for v in self.studio_vars.values() if v.get())
            self.adv_status_lbl.config(text=f"Exclude Mode ({selected_count} studios selected to ban)", fg=self.warning_color)
        elif mode == "Include":
            selected_count = sum(1 for v in self.studio_vars.values() if v.get())
            self.adv_status_lbl.config(text=f"Include Mode ({selected_count} studios selected to download)", fg=self.success_color)

    def open_advanced_filter(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("Advanced Studio Filter")
        dialog.geometry("520x650")
        dialog.minsize(450, 550)
        dialog.configure(bg=self.bg_dark)
        dialog.transient(self.root)
        dialog.grab_set()
        
        dialog.geometry(f"+{self.root.winfo_x() + 80}+{self.root.winfo_y() + 40}")
        
        # 1. Scan Source Folder
        scan_frame = tk.LabelFrame(dialog, text=" SCAN SOURCE FOR STUDIOS ", font=("Segoe UI", 9, "bold"), 
                                   bg=self.bg_dark, fg=self.accent_color, highlightbackground=self.border_color, highlightthickness=1)
        scan_frame.pack(fill="x", padx=16, pady=12, ipady=4)
        scan_frame.columnconfigure(1, weight=1)
        
        dir_lbl = tk.Label(scan_frame, text="Source Folder:", font=("Segoe UI", 9, "bold"), bg=self.bg_dark, fg=self.text_muted)
        dir_lbl.grid(row=0, column=0, sticky="w", padx=8, pady=4)
        
        dir_entry = tk.Entry(scan_frame, textvariable=self.scan_dir_var, font=("Segoe UI", 9), bg="#050508", fg=self.text_main,
                             insertbackground=self.text_main, borderwidth=1, relief="solid")
        dir_entry.grid(row=0, column=1, sticky="ew", padx=4, pady=4)
        
        def browse_scan_dir():
            sel = filedialog.askdirectory(initialdir=self.scan_dir_var.get())
            if sel:
                self.scan_dir_var.set(sel)
                rebuild_list()
                
        btn_browse = tk.Button(scan_frame, text="Browse...", font=("Segoe UI", 8, "bold"), bg=self.bg_card, fg=self.text_main,
                               activebackground="#1e1e2f", activeforeground=self.text_main, borderwidth=1, relief="flat", command=browse_scan_dir)
        btn_browse.grid(row=0, column=2, sticky="e", padx=4, pady=4)
        
        btn_scan = tk.Button(scan_frame, text="🔄 Scan Studios", font=("Segoe UI", 8, "bold"), bg=self.accent_color, fg=self.text_main,
                             activebackground="#4f46e5", activeforeground=self.text_main, borderwidth=0, relief="flat", command=lambda: rebuild_list())
        btn_scan.grid(row=0, column=3, sticky="e", padx=8, pady=4)

        # 2. Filter Mode
        mode_frame = tk.LabelFrame(dialog, text=" FILTER MODE ", font=("Segoe UI", 9, "bold"),
                                   bg=self.bg_dark, fg=self.accent_color, highlightbackground=self.border_color, highlightthickness=1)
        mode_frame.pack(fill="x", padx=16, pady=4, ipady=4)
        
        modes = [
            ("Disabled", "Disabled (Use only basic Exclude text)"),
            ("Exclude", "Exclude Selected (Blacklist)"),
            ("Include", "Include Selected (Whitelist)")
        ]
        
        for val, txt in modes:
            rb = tk.Radiobutton(mode_frame, text=txt, variable=self.advanced_filter_mode, value=val,
                                font=("Segoe UI", 9), bg=self.bg_dark, fg=self.text_main, selectcolor=self.bg_dark,
                                activebackground=self.bg_dark, activeforeground=self.text_main)
            rb.pack(anchor="w", padx=16, pady=2)

        # 3. Studios Checklist
        list_container = tk.LabelFrame(dialog, text=" STUDIOS LIST ", font=("Segoe UI", 9, "bold"),
                                       bg=self.bg_dark, fg=self.accent_color, highlightbackground=self.border_color, highlightthickness=1)
        list_container.pack(fill="both", expand=True, padx=16, pady=8)
        
        search_frame = tk.Frame(list_container, bg=self.bg_dark)
        search_frame.pack(fill="x", padx=8, pady=4)
        
        search_lbl = tk.Label(search_frame, text="🔍 Search:", font=("Segoe UI", 9, "bold"), bg=self.bg_dark, fg=self.text_muted)
        search_lbl.pack(side="left", padx=(0, 4))
        
        search_var = tk.StringVar()
        search_entry = tk.Entry(search_frame, textvariable=search_var, font=("Segoe UI", 9), bg="#050508", fg=self.text_main,
                                insertbackground=self.text_main, borderwidth=1, relief="solid")
        search_entry.pack(side="left", fill="x", expand=True, padx=4)
        
        btn_frame = tk.Frame(list_container, bg=self.bg_dark)
        btn_frame.pack(fill="x", padx=8, pady=4)
        
        canvas_frame = tk.Frame(list_container, bg=self.bg_dark)
        canvas_frame.pack(fill="both", expand=True, padx=8, pady=4)
        
        canvas = tk.Canvas(canvas_frame, bg="#050508", highlightthickness=0)
        scrollbar = tk.Scrollbar(canvas_frame, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg="#050508")
        
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(
                scrollregion=canvas.bbox("all")
            )
        )
        
        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)
        
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
            
        canvas.bind_all("<MouseWheel>", _on_mousewheel)
        
        checkboxes = []
        
        def rebuild_list(*args):
            for cb in checkboxes:
                cb.destroy()
            checkboxes.clear()
            
            search_query = search_var.get().lower().strip()
            
            scanned = self.scan_studios()
            all_studios = set(scanned) | set(self.config["selected_studios"])
            sorted_all_studios = sorted(list(all_studios), key=str.lower)
            
            if not sorted_all_studios:
                empty_lbl = tk.Label(scrollable_frame, text="No studios found. Please check your source folder path.",
                                     font=("Segoe UI", 9, "italic"), bg="#050508", fg=self.text_muted)
                empty_lbl.pack(padx=16, pady=16)
                checkboxes.append(empty_lbl)
                return
            
            for s in sorted_all_studios:
                if search_query and search_query not in s.lower():
                    continue
                    
                cb_frame = tk.Frame(scrollable_frame, bg="#050508")
                cb_frame.pack(fill="x", anchor="w", padx=8, pady=2)
                checkboxes.append(cb_frame)
                
                cb = tk.Checkbutton(cb_frame, text=s, variable=self.studio_vars[s],
                                    font=("Segoe UI", 9), bg="#050508", fg=self.text_main, selectcolor="#050508",
                                    activebackground="#050508", activeforeground=self.text_main,
                                    highlightthickness=0, bd=0)
                cb.pack(side="left")
        
        def get_filtered_studios():
            search_query = search_var.get().lower().strip()
            scanned = self.scan_studios()
            all_studios = set(scanned) | set(self.config["selected_studios"])
            sorted_all = sorted(list(all_studios), key=str.lower)
            if not search_query:
                return sorted_all
            return [s for s in sorted_all if search_query in s.lower()]
            
        def select_all():
            for s in get_filtered_studios():
                self.studio_vars[s].set(True)
                
        def clear_all():
            for s in get_filtered_studios():
                self.studio_vars[s].set(False)
                
        def invert_selection():
            for s in get_filtered_studios():
                self.studio_vars[s].set(not self.studio_vars[s].get())
                
        tk.Button(btn_frame, text="Select All", font=("Segoe UI", 8, "bold"), bg=self.bg_card, fg=self.text_main, relief="flat", command=select_all).pack(side="left", padx=2)
        tk.Button(btn_frame, text="Clear All", font=("Segoe UI", 8, "bold"), bg=self.bg_card, fg=self.text_main, relief="flat", command=clear_all).pack(side="left", padx=2)
        tk.Button(btn_frame, text="Invert Selection", font=("Segoe UI", 8, "bold"), bg=self.bg_card, fg=self.text_main, relief="flat", command=invert_selection).pack(side="left", padx=2)

        search_var.trace_add("write", rebuild_list)

        footer_frame = tk.Frame(dialog, bg=self.bg_dark)
        footer_frame.pack(fill="x", padx=16, pady=12)
        
        def on_dialog_close():
            canvas.unbind_all("<MouseWheel>")
            dialog.destroy()
            
        def save_and_close():
            self.save_config()
            self.update_status_lbl()
            on_dialog_close()
            
        def cancel_and_close():
            self.config = self.load_config()
            self.advanced_filter_mode.set(self.config["advanced_filter_mode"])
            self.scan_dir_var.set(self.config["scan_dir"])
            for s, var in self.studio_vars.items():
                var.set(s in self.config["selected_studios"])
            on_dialog_close()
            
        dialog.protocol("WM_DELETE_WINDOW", cancel_and_close)
        
        btn_save = tk.Button(footer_frame, text="💾 Save & Apply", font=("Segoe UI", 10, "bold"), bg=self.success_color, fg=self.text_main,
                             activebackground="#059669", activeforeground=self.text_main, borderwidth=0, relief="flat", height=2, width=15, command=save_and_close)
        btn_save.pack(side="right", padx=4)
        
        btn_cancel = tk.Button(footer_frame, text="❌ Cancel", font=("Segoe UI", 10, "bold"), bg=self.bg_card, fg=self.text_main,
                               activebackground="#1e1e2f", activeforeground=self.text_main, borderwidth=1, relief="flat", height=2, width=12, command=cancel_and_close)
        btn_cancel.pack(side="right", padx=4)

        rebuild_list()

def main():
    root = tk.Tk()
    app = PornRipsGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()
