"""
GUI for Fetch Wallpaper Scraper using customtkinter.
"""

import os
import sys
import queue
import logging
import threading
import tkinter as tk
from tkinter import filedialog, messagebox
import customtkinter as ctk

from src.scraper import WallpaperScraper
from src.direct_download import download_url_list
from src.bunkr_download import resolve_bunkr_links

# Set up appearance and color theme
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("dark-blue")

# Custom logging handler to redirect logs to a queue
class QueueHandler(logging.Handler):
    def __init__(self, log_queue):
        super().__init__()
        self.log_queue = log_queue

    def emit(self, record):
        self.log_queue.put(record)

class GuiLogger:
    def __init__(self, textbox_widget):
        self.textbox_widget = textbox_widget
        self.queue = queue.Queue()
        self.handler = QueueHandler(self.queue)
        
        # Format logs with timestamps
        formatter = logging.Formatter('%(asctime)s [%(levelname)s] %(message)s', datefmt='%H:%M:%S')
        self.handler.setFormatter(formatter)
        
        # Add handler to the root logger
        self.logger = logging.getLogger()
        self.logger.addHandler(self.handler)
        self.logger.setLevel(logging.INFO)
        
        # Start the queue polling loop
        self.check_queue()

    def check_queue(self):
        """Check the queue for new log records and display them in the textbox in a batch."""
        lines = []
        try:
            while True:
                record = self.queue.get_nowait()
                msg = self.handler.format(record)
                lines.append(msg)
        except queue.Empty:
            pass

        if lines:
            self.textbox_widget.configure(state='normal')
            self.textbox_widget.insert(tk.END, '\n'.join(lines) + '\n')
            self.textbox_widget.configure(state='disabled')
            self.textbox_widget.see(tk.END)  # Auto-scroll

        # Schedule the next check in 100ms
        self.textbox_widget.after(100, self.check_queue)

class FetchWallpaperGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Fetch Wallpaper Scraper")
        self.root.geometry("1050x720")
        self.root.minsize(950, 650)
        
        # Scraper state variables
        self.is_running = False
        self.scraper_thread = None
        self.stop_requested = False
        self.scraper = None
        
        # 1. Load configuration defaults (falling back if default.yaml is missing)
        self.config_defaults = {
            'min_width': 800,
            'min_height': 600,
            'download_dir': os.path.abspath(os.path.join(os.getcwd(), 'downloads')),
            'rate_limit': 1.0,
            'timeout': 30,
            'max_pages': 100,
            'crawl_depth': 3,
            'max_workers': 10
        }
        self.load_config_defaults()
        
        # 2. Load list of available site configurations
        self.sites = self.load_site_list()
        
        # 3. Create GUI elements
        self.create_widgets()
        
        # 4. Initialize real-time logging redirection
        self.gui_logger = GuiLogger(self.log_textbox)

    def load_config_defaults(self):
        """Load default configuration from configs/default.yaml if present."""
        default_yaml_path = os.path.join(os.getcwd(), 'configs', 'default.yaml')
        if os.path.exists(default_yaml_path):
            try:
                import yaml
                with open(default_yaml_path, 'r') as f:
                    cfg = yaml.safe_load(f)
                    if cfg and 'general' in cfg:
                        g = cfg['general']
                        self.config_defaults['min_width'] = g.get('min_width', 800)
                        self.config_defaults['min_height'] = g.get('min_height', 600)
                        
                        dd = g.get('download_dir', './downloads')
                        if dd.startswith('./') or dd.startswith('.\\'):
                            self.config_defaults['download_dir'] = os.path.abspath(os.path.join(os.getcwd(), dd))
                        else:
                            self.config_defaults['download_dir'] = os.path.abspath(dd)
                            
                        self.config_defaults['rate_limit'] = g.get('rate_limit', 1.0)
                        self.config_defaults['timeout'] = g.get('timeout', 30)
                        self.config_defaults['max_pages'] = g.get('max_pages', 100)
                        self.config_defaults['crawl_depth'] = g.get('crawl_depth', 3)
                        self.config_defaults['max_workers'] = g.get('max_workers', 10)
            except Exception as e:
                print(f"Error loading defaults from configs/default.yaml: {e}")

    def load_site_list(self):
        """Load available site configurations from configs/sites directory."""
        site_dir = os.path.join(os.getcwd(), 'configs', 'sites')
        sites = []
        if os.path.exists(site_dir):
            for file in os.listdir(site_dir):
                if file.endswith('.yaml') or file.endswith('.yml'):
                    sites.append(file[:-5])
        
        # Default fallback
        if 'margaretqualley' not in sites:
            sites.insert(0, 'margaretqualley')
        return sites

    def create_widgets(self):
        # Configure layout grid for main root window
        self.root.grid_columnconfigure(0, weight=4)  # Config panel
        self.root.grid_columnconfigure(1, weight=5)  # Log & control panel
        self.root.grid_rowconfigure(0, weight=1)

        # Fonts
        title_font = ctk.CTkFont(family="Segoe UI", size=22, weight="bold")
        section_font = ctk.CTkFont(family="Segoe UI", size=15, weight="bold")
        label_font = ctk.CTkFont(family="Segoe UI", size=12, weight="normal")
        bold_label_font = ctk.CTkFont(family="Segoe UI", size=12, weight="bold")

        # ==================== LEFT CONFIG PANEL ====================
        left_panel = ctk.CTkFrame(self.root, corner_radius=15)
        left_panel.grid(row=0, column=0, sticky="nsew", padx=15, pady=15)
        left_panel.grid_columnconfigure(0, weight=1)
        left_panel.grid_rowconfigure(1, weight=1)  # Expand scrollable area

        # Title Card
        title_frame = ctk.CTkFrame(left_panel, fg_color="transparent")
        title_frame.grid(row=0, column=0, sticky="ew", padx=20, pady=(20, 10))
        
        app_title = ctk.CTkLabel(
            title_frame, 
            text="FETCH-WP SCRAPER", 
            font=title_font, 
            text_color="#6366f1"
        )
        app_title.pack(anchor="w")
        
        app_subtitle = ctk.CTkLabel(
            title_frame, 
            text="Wallpaper Downloader Settings", 
            font=ctk.CTkFont(family="Segoe UI", size=12, slant="italic"), 
            text_color="#9ca3af"
        )
        app_subtitle.pack(anchor="w")

        # Scrollable settings area
        settings_canvas = ctk.CTkScrollableFrame(left_panel, fg_color="transparent")
        settings_canvas.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 15))
        settings_canvas.grid_columnconfigure(0, weight=1)

        # --- Section 1: Site Selector ---
        site_sec = ctk.CTkFrame(settings_canvas, corner_radius=10)
        site_sec.grid(row=0, column=0, sticky="ew", padx=5, pady=10)
        site_sec.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(site_sec, text="Target Website Selection", font=section_font, text_color="#f3f4f6").grid(row=0, column=0, sticky="w", padx=15, pady=(12, 8))

        ctk.CTkLabel(site_sec, text="Preset Site Config:", font=label_font).grid(row=1, column=0, sticky="w", padx=15, pady=(5, 2))
        self.site_combobox = ctk.CTkComboBox(
            site_sec, 
            values=self.sites, 
            command=self.on_site_selected,
            height=32
        )
        self.site_combobox.grid(row=2, column=0, sticky="ew", padx=15, pady=(0, 10))
        self.site_combobox.set(self.sites[0])

        ctk.CTkLabel(site_sec, text="Or Custom Target URL (Overrides Preset):", font=label_font).grid(row=3, column=0, sticky="w", padx=15, pady=(5, 2))
        self.custom_url_entry = ctk.CTkEntry(
            site_sec, 
            placeholder_text="https://example.com/gallery",
            height=32
        )
        self.custom_url_entry.grid(row=4, column=0, sticky="ew", padx=15, pady=(0, 15))
        
        # --- Section 2: Scraping Filters ---
        filter_sec = ctk.CTkFrame(settings_canvas, corner_radius=10)
        filter_sec.grid(row=1, column=0, sticky="ew", padx=5, pady=10)
        filter_sec.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkLabel(filter_sec, text="Wallpaper Resolution Filters", font=section_font, text_color="#f3f4f6").grid(row=0, column=0, columnspan=2, sticky="w", padx=15, pady=(12, 8))

        ctk.CTkLabel(filter_sec, text="Min Width (px):", font=label_font).grid(row=1, column=0, sticky="w", padx=15, pady=(5, 2))
        self.min_width_entry = ctk.CTkEntry(filter_sec, height=32)
        self.min_width_entry.grid(row=2, column=0, sticky="ew", padx=(15, 5), pady=(0, 12))
        self.min_width_entry.insert(0, str(self.config_defaults['min_width']))

        ctk.CTkLabel(filter_sec, text="Min Height (px):", font=label_font).grid(row=1, column=1, sticky="w", padx=5, pady=(5, 2))
        self.min_height_entry = ctk.CTkEntry(filter_sec, height=32)
        self.min_height_entry.grid(row=2, column=1, sticky="ew", padx=(5, 15), pady=(0, 12))
        self.min_height_entry.insert(0, str(self.config_defaults['min_height']))

        # --- Section 3: Performance & Network ---
        perf_sec = ctk.CTkFrame(settings_canvas, corner_radius=10)
        perf_sec.grid(row=2, column=0, sticky="ew", padx=5, pady=10)
        perf_sec.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkLabel(perf_sec, text="Performance & Connection", font=section_font, text_color="#f3f4f6").grid(row=0, column=0, columnspan=2, sticky="w", padx=15, pady=(12, 8))

        ctk.CTkLabel(perf_sec, text="Rate Limit (Sec Delay):", font=label_font).grid(row=1, column=0, sticky="w", padx=15, pady=(5, 2))
        self.rate_limit_entry = ctk.CTkEntry(perf_sec, height=32)
        self.rate_limit_entry.grid(row=2, column=0, sticky="ew", padx=(15, 5), pady=(0, 12))
        self.rate_limit_entry.insert(0, str(self.config_defaults['rate_limit']))

        ctk.CTkLabel(perf_sec, text="Request Timeout (Sec):", font=label_font).grid(row=1, column=1, sticky="w", padx=5, pady=(5, 2))
        self.timeout_entry = ctk.CTkEntry(perf_sec, height=32)
        self.timeout_entry.grid(row=2, column=1, sticky="ew", padx=(5, 15), pady=(0, 12))
        self.timeout_entry.insert(0, str(self.config_defaults['timeout']))

        ctk.CTkLabel(perf_sec, text="Max Crawl Pages:", font=label_font).grid(row=3, column=0, sticky="w", padx=15, pady=(5, 2))
        self.max_pages_entry = ctk.CTkEntry(perf_sec, height=32)
        self.max_pages_entry.grid(row=4, column=0, sticky="ew", padx=(15, 5), pady=(0, 12))
        self.max_pages_entry.insert(0, str(self.config_defaults['max_pages']))

        ctk.CTkLabel(perf_sec, text="Max Crawl Depth:", font=label_font).grid(row=3, column=1, sticky="w", padx=5, pady=(5, 2))
        self.crawl_depth_entry = ctk.CTkEntry(perf_sec, height=32)
        self.crawl_depth_entry.grid(row=4, column=1, sticky="ew", padx=(5, 15), pady=(0, 12))
        self.crawl_depth_entry.insert(0, str(self.config_defaults['crawl_depth']))

        ctk.CTkLabel(perf_sec, text="Parallel Fetch Threads:", font=label_font).grid(row=5, column=0, sticky="w", padx=15, pady=(5, 2))
        self.max_workers_entry = ctk.CTkEntry(perf_sec, height=32)
        self.max_workers_entry.grid(row=6, column=0, sticky="ew", padx=(15, 5), pady=(0, 12))
        self.max_workers_entry.insert(0, str(self.config_defaults['max_workers']))

        # --- Section 4: Output Location ---
        out_sec = ctk.CTkFrame(settings_canvas, corner_radius=10)
        out_sec.grid(row=3, column=0, sticky="ew", padx=5, pady=10)
        out_sec.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(out_sec, text="Download Directory", font=section_font, text_color="#f3f4f6").grid(row=0, column=0, sticky="w", padx=15, pady=(12, 8))

        path_frame = ctk.CTkFrame(out_sec, fg_color="transparent")
        path_frame.grid(row=1, column=0, sticky="ew", padx=15, pady=(0, 15))
        path_frame.grid_columnconfigure(0, weight=1)

        self.download_dir_entry = ctk.CTkEntry(path_frame, height=32)
        self.download_dir_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))
        self.download_dir_entry.insert(0, self.config_defaults['download_dir'])

        browse_btn = ctk.CTkButton(
            path_frame, 
            text="Browse...", 
            width=80, 
            height=32,
            command=self.browse_download_dir
        )
        browse_btn.grid(row=0, column=1, sticky="e")

        # --- Section 5: URL List Downloader ---
        url_sec = ctk.CTkFrame(settings_canvas, corner_radius=10)
        url_sec.grid(row=4, column=0, sticky="ew", padx=5, pady=10)
        url_sec.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(url_sec, text="URL List Downloader", font=section_font, text_color="#f3f4f6").grid(row=0, column=0, sticky="w", padx=15, pady=(12, 8))
        ctk.CTkLabel(url_sec, text="Load a .txt file with one URL per line to download files directly:", font=label_font).grid(row=1, column=0, sticky="w", padx=15, pady=(2, 8))

        url_file_frame = ctk.CTkFrame(url_sec, fg_color="transparent")
        url_file_frame.grid(row=2, column=0, sticky="ew", padx=15, pady=(0, 15))
        url_file_frame.grid_columnconfigure(0, weight=1)

        self.url_list_file_entry = ctk.CTkEntry(
            url_file_frame,
            placeholder_text="G:\\path\\to\\url_list.txt",
            height=32
        )
        self.url_list_file_entry.grid(row=0, column=0, sticky="ew", padx=(0, 8))

        browse_url_btn = ctk.CTkButton(
            url_file_frame,
            text="Browse...",
            width=80,
            height=32,
            command=self.browse_url_list_file
        )
        browse_url_btn.grid(row=0, column=1, sticky="e")

        # --- Section 6: Bunkr Downloader ---
        bunkr_sec = ctk.CTkFrame(settings_canvas, corner_radius=10)
        bunkr_sec.grid(row=5, column=0, sticky="ew", padx=5, pady=10)
        bunkr_sec.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(bunkr_sec, text="Bunkr Link Extractor", font=section_font, text_color="#f3f4f6").grid(row=0, column=0, sticky="w", padx=15, pady=(12, 8))
        ctk.CTkLabel(bunkr_sec, text="Paste a bunkr.cr album or file URL to get signed download links:", font=label_font).grid(row=1, column=0, sticky="w", padx=15, pady=(2, 8))

        self.bunkr_url_entry = ctk.CTkEntry(
            bunkr_sec,
            placeholder_text="https://bunkr.cr/a/albumSlug  or  /f/fileSlug",
            height=32
        )
        self.bunkr_url_entry.grid(row=2, column=0, sticky="ew", padx=15, pady=(0, 15))

        # ==================== RIGHT LOG & CONTROL PANEL ====================
        right_panel = ctk.CTkFrame(self.root, corner_radius=15)
        right_panel.grid(row=0, column=1, sticky="nsew", padx=15, pady=15)
        right_panel.grid_columnconfigure(0, weight=1)
        right_panel.grid_rowconfigure(2, weight=1)  # Expand log textbox

        # Control Panel Grid
        control_sec = ctk.CTkFrame(right_panel, corner_radius=10)
        control_sec.grid(row=0, column=0, sticky="ew", padx=15, pady=15)
        control_sec.grid_columnconfigure((0, 1), weight=1)

        self.start_button = ctk.CTkButton(
            control_sec, 
            text="Start Scraping", 
            font=bold_label_font, 
            height=40,
            fg_color="#10b981", 
            hover_color="#059669",
            command=self.start_scraping
        )
        self.start_button.grid(row=0, column=0, padx=(15, 8), pady=15, sticky="ew")

        self.stop_button = ctk.CTkButton(
            control_sec, 
            text="Stop Process", 
            font=bold_label_font, 
            height=40,
            fg_color="#ef4444", 
            hover_color="#dc2626",
            state="disabled",
            command=self.stop_scraping
        )
        self.stop_button.grid(row=0, column=1, padx=(8, 15), pady=15, sticky="ew")

        self.open_folder_button = ctk.CTkButton(
            control_sec, 
            text="Open Download Folder", 
            height=32,
            fg_color="#3b82f6",
            hover_color="#2563eb",
            command=self.open_download_folder
        )
        self.open_folder_button.grid(row=1, column=0, padx=(15, 8), pady=(0, 15), sticky="ew")

        self.clear_logs_button = ctk.CTkButton(
            control_sec, 
            text="Clear Log Terminal", 
            height=32,
            fg_color="#6b7280",
            hover_color="#4b5563",
            command=self.clear_logs
        )
        self.clear_logs_button.grid(row=1, column=1, padx=(8, 15), pady=(0, 15), sticky="ew")

        # Status & Progress Frame
        status_frame = ctk.CTkFrame(right_panel, fg_color="transparent")
        status_frame.grid(row=1, column=0, sticky="ew", padx=15, pady=(0, 10))
        status_frame.grid_columnconfigure(0, weight=1)

        self.status_label = ctk.CTkLabel(
            status_frame, 
            text="Status: Ready", 
            font=bold_label_font,
            text_color="#9ca3af"
        )
        self.status_label.grid(row=0, column=0, sticky="w", padx=5)

        self.progress_bar = ctk.CTkProgressBar(status_frame, height=8, mode="indeterminate")
        self.progress_bar.grid(row=1, column=0, sticky="ew", padx=5, pady=(5, 5))
        self.progress_bar.set(0)

        # Logging Terminal Screen
        log_frame = ctk.CTkFrame(right_panel, corner_radius=10)
        log_frame.grid(row=2, column=0, sticky="nsew", padx=15, pady=(0, 15))
        log_frame.grid_columnconfigure(0, weight=1)
        log_frame.grid_rowconfigure(1, weight=1)

        ctk.CTkLabel(log_frame, text="Log Output Console", font=section_font, text_color="#f3f4f6").grid(row=0, column=0, sticky="w", padx=15, pady=(10, 5))

        self.log_textbox = ctk.CTkTextbox(
            log_frame, 
            font=ctk.CTkFont(family="Consolas", size=12),
            state="disabled",
            text_color="#34d399",  # Matrix green logs
            fg_color="#111827",    # Sleek dark background
            border_width=1,
            border_color="#374151"
        )
        self.log_textbox.grid(row=1, column=0, sticky="nsew", padx=10, pady=(0, 10))

    def on_site_selected(self, choice):
        """Clear custom URL entry when preset site is chosen to prevent confusion."""
        if choice:
            self.custom_url_entry.delete(0, tk.END)

    def browse_download_dir(self):
        """Open file dialog to browse and select download directory."""
        initial_dir = self.download_dir_entry.get().strip() or os.getcwd()
        if not os.path.exists(initial_dir):
            initial_dir = os.getcwd()

        selected = filedialog.askdirectory(initialdir=initial_dir, title="Select Download Folder")
        if selected:
            selected_abs = os.path.abspath(selected)
            self.download_dir_entry.delete(0, tk.END)
            self.download_dir_entry.insert(0, selected_abs)

    def browse_url_list_file(self):
        """Open file dialog to browse and select a URL list text file."""
        initial_dir = os.getcwd()
        selected = filedialog.askopenfilename(
            initialdir=initial_dir,
            title="Select URL List File",
            filetypes=[("Text Files", "*.txt"), ("All Files", "*.*")]
        )
        if selected:
            self.url_list_file_entry.delete(0, tk.END)
            self.url_list_file_entry.insert(0, os.path.abspath(selected))

    def clear_logs(self):
        """Clear the console text widget."""
        self.log_textbox.configure(state="normal")
        self.log_textbox.delete(1.0, tk.END)
        self.log_textbox.configure(state="disabled")

    def open_download_folder(self):
        """Open the configured downloads directory in File Explorer."""
        download_dir = self.download_dir_entry.get().strip()
        if not download_dir:
            download_dir = os.path.join(os.getcwd(), 'downloads')
        
        if not os.path.exists(download_dir):
            try:
                os.makedirs(download_dir, exist_ok=True)
            except Exception as e:
                messagebox.showerror("Error", f"Could not create folder: {e}")
                return
        
        try:
            # Platform specific explorer opening
            if sys.platform == 'win32':
                os.startfile(download_dir)
            elif sys.platform == 'darwin':
                import subprocess
                subprocess.Popen(['open', download_dir])
            else:
                import subprocess
                subprocess.Popen(['xdg-open', download_dir])
        except Exception as e:
            messagebox.showerror("Error", f"Failed to open download folder: {e}")

    def start_scraping(self):
        """Initiate inputs validation and launch scraper in a separate daemon thread."""
        if self.is_running:
            return

        # 1. Fetch values
        site = self.site_combobox.get().strip()
        custom_url = self.custom_url_entry.get().strip()
        download_dir = self.download_dir_entry.get().strip()
        url_list_file = self.url_list_file_entry.get().strip()
        bunkr_url = self.bunkr_url_entry.get().strip()

        # 2. Validate Inputs
        # Bunkr mode
        if bunkr_url:
            if 'bunkr.' not in bunkr_url:
                messagebox.showerror("Validation Error", "Please enter a valid bunkr.cr URL.")
                return
            if not download_dir:
                messagebox.showerror("Validation Error", "Please specify a download directory.")
                return
            self._launch_bunkr(bunkr_url, download_dir)
            return

        # URL list mode: only need the file and download dir
        if url_list_file:
            if not os.path.isfile(url_list_file):
                messagebox.showerror("Validation Error", f"URL list file not found:\n{url_list_file}")
                return
            if not download_dir:
                messagebox.showerror("Validation Error", "Please specify a download directory.")
                return
            # Skip other validation, go straight to launch
            self._launch_download(url_list_file, download_dir)
            return

        if not custom_url and not site:
            messagebox.showerror("Validation Error", "Please select a preset site, enter a custom URL, load a URL list, or enter a bunkr URL.")
            return

        try:
            min_width = int(self.min_width_entry.get().strip())
            if min_width <= 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Validation Error", "Min Width must be a positive integer.")
            return

        try:
            min_height = int(self.min_height_entry.get().strip())
            if min_height <= 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Validation Error", "Min Height must be a positive integer.")
            return

        try:
            rate_limit = float(self.rate_limit_entry.get().strip())
            if rate_limit < 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Validation Error", "Rate Limit must be a non-negative number.")
            return

        try:
            timeout = int(self.timeout_entry.get().strip())
            if timeout <= 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Validation Error", "Timeout must be a positive integer.")
            return

        try:
            max_pages = int(self.max_pages_entry.get().strip())
            if max_pages <= 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Validation Error", "Max Crawl Pages must be a positive integer.")
            return

        try:
            crawl_depth = int(self.crawl_depth_entry.get().strip())
            if crawl_depth < 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Validation Error", "Max Crawl Depth must be a non-negative integer.")
            return

        try:
            max_workers = int(self.max_workers_entry.get().strip())
            if max_workers <= 0:
                raise ValueError
        except ValueError:
            messagebox.showerror("Validation Error", "Parallel Fetch Threads must be a positive integer.")
            return

        if not download_dir:
            messagebox.showerror("Validation Error", "Please specify a download directory.")
            return

        # 3. Update UI state
        self.is_running = True
        self.stop_requested = False
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        self.status_label.configure(text="Status: Starting scraper thread...", text_color="#6366f1")
        self.progress_bar.start()

        # Clear old logs before starting new run
        self.clear_logs()

        # 4. Start background scraper thread
        self.scraper_thread = threading.Thread(
            target=self.run_scraper,
            args=(site, custom_url, download_dir, min_width, min_height, rate_limit, timeout, max_pages, crawl_depth, max_workers)
        )
        self.scraper_thread.daemon = True
        self.scraper_thread.start()

        # 5. Monitor thread execution
        self.root.after(100, self.check_thread)

    def _launch_download(self, url_list_file, download_dir):
        """Launch direct URL list download in a background thread."""
        timeout = 30
        rate_limit = 1.0
        min_width = 800
        min_height = 600
        try:
            timeout = int(self.timeout_entry.get().strip())
        except ValueError:
            pass
        try:
            rate_limit = float(self.rate_limit_entry.get().strip())
        except ValueError:
            pass
        try:
            min_width = int(self.min_width_entry.get().strip())
        except ValueError:
            pass
        try:
            min_height = int(self.min_height_entry.get().strip())
        except ValueError:
            pass

        self.is_running = True
        self.stop_requested = False
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        self.status_label.configure(text="Status: Starting URL list download...", text_color="#6366f1")
        self.progress_bar.start()

        self.clear_logs()

        self.scraper_thread = threading.Thread(
            target=self.run_url_download,
            args=(url_list_file, download_dir, timeout, rate_limit, min_width, min_height)
        )
        self.scraper_thread.daemon = True
        self.scraper_thread.start()

        self.root.after(100, self.check_thread)

    def _launch_bunkr(self, bunkr_url, download_dir):
        """Launch bunkr link extraction in a background thread."""
        timeout = 30
        rate_limit = 1.0
        try:
            timeout = int(self.timeout_entry.get().strip())
        except ValueError:
            pass
        try:
            rate_limit = float(self.rate_limit_entry.get().strip())
        except ValueError:
            pass

        self.is_running = True
        self.stop_requested = False
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        self.status_label.configure(text="Status: Resolving bunkr links...", text_color="#6366f1")
        self.progress_bar.start()

        self.clear_logs()

        self.scraper_thread = threading.Thread(
            target=self.run_bunkr_links,
            args=(bunkr_url, timeout, rate_limit)
        )
        self.scraper_thread.daemon = True
        self.scraper_thread.start()

        self.root.after(100, self.check_thread)

    def stop_scraping(self):
        """Signal the scraper and downloader to stop executing."""
        if not self.is_running:
            return

        self.stop_requested = True
        if self.scraper:
            self.scraper.stop()
            
        self.status_label.configure(text="Status: Requesting Stop...", text_color="#ef4444")
        self.stop_button.configure(state="disabled")

    def run_scraper(self, site, custom_url, download_dir, min_width, min_height, rate_limit, timeout, max_pages, crawl_depth, max_workers):
        """Target run method executed inside the background thread."""
        try:
            # Determine correct site name and target URL
            if custom_url:
                site_name = "custom"
                base_url = custom_url
            else:
                site_name = site
                # Create a temporary instance to retrieve configured base_url
                temp_scraper = WallpaperScraper(site_name)
                base_url = temp_scraper.config.get('site', {}).get('base_url', f"https://{site_name}.org/")

            # Instantiate main scraper
            self.scraper = WallpaperScraper(site_name)

            # Inject settings directly into the configuration dict
            if 'general' not in self.scraper.config:
                self.scraper.config['general'] = {}
            
            self.scraper.config['general'].update({
                'min_width': min_width,
                'min_height': min_height,
                'download_dir': download_dir,
                'rate_limit': rate_limit,
                'timeout': timeout,
                'max_pages': max_pages,
                'crawl_depth': crawl_depth,
                'max_workers': max_workers
            })

            if custom_url:
                if 'site' not in self.scraper.config:
                    self.scraper.config['site'] = {}
                self.scraper.config['site']['base_url'] = custom_url

            if self.stop_requested:
                return

            # Update status in the GUI main thread
            self.root.after(0, lambda: self.status_label.configure(text=f"Status: Scraping {base_url}...", text_color="#f59e0b"))

            # Start Scraping
            self.scraper.run()

            # Final status update
            if self.stop_requested:
                self.root.after(0, lambda: self.status_label.configure(text="Status: Scraper Stopped", text_color="#ef4444"))
            else:
                self.root.after(0, lambda: self.status_label.configure(text="Status: Scraping Completed", text_color="#10b981"))

        except Exception as e:
            logging.error(f"Error in scraper thread: {e}", exc_info=True)
            self.root.after(0, lambda: self.status_label.configure(text=f"Status: Error: {str(e)}", text_color="#ef4444"))

    def run_url_download(self, url_list_file, download_dir, timeout, rate_limit, min_width, min_height):
        """Target run method for downloading images from a URL list."""
        try:
            self.root.after(0, lambda: self.status_label.configure(
                text=f"Status: Downloading from URL list...", text_color="#f59e0b"))

            downloaded = download_url_list(
                file_path=url_list_file,
                download_dir=download_dir,
                timeout=timeout,
                rate_limit=rate_limit,
                min_width=min_width,
                min_height=min_height,
                stop_checker=lambda: self.stop_requested
            )

            if self.stop_requested:
                self.root.after(0, lambda: self.status_label.configure(
                    text="Status: Download Stopped", text_color="#ef4444"))
            else:
                msg = f"Status: Downloaded {downloaded} images"
                self.root.after(0, lambda m=msg: self.status_label.configure(text=m, text_color="#10b981"))

        except Exception as e:
            logging.error(f"Error in URL download thread: {e}", exc_info=True)
            self.root.after(0, lambda: self.status_label.configure(
                text=f"Status: Error: {str(e)}", text_color="#ef4444"))

    def run_bunkr_links(self, bunkr_url, timeout, rate_limit):
        """Target run method for extracting bunkr download links."""
        try:
            self.root.after(0, lambda: self.status_label.configure(
                text="Status: Resolving bunkr links...", text_color="#f59e0b"))

            links = resolve_bunkr_links(
                url=bunkr_url,
                timeout=timeout,
                rate_limit=rate_limit,
                stop_checker=lambda: self.stop_requested
            )

            if self.stop_requested:
                self.root.after(0, lambda: self.status_label.configure(
                    text="Status: Stopped", text_color="#ef4444"))
            else:
                msg = f"Status: Resolved {len(links)} download links (see log above)"
                self.root.after(0, lambda m=msg: self.status_label.configure(text=m, text_color="#10b981"))

        except Exception as e:
            logging.error(f"Error in bunkr link resolver: {e}", exc_info=True)
            self.root.after(0, lambda: self.status_label.configure(
                text=f"Status: Error: {str(e)}", text_color="#ef4444"))

    def check_thread(self):
        """Monitor the status of the scraper thread and reset UI controls when completed."""
        if self.scraper_thread and self.scraper_thread.is_alive():
            # Still working, re-poll later
            self.root.after(100, self.check_thread)
        else:
            # Finished
            self.is_running = False
            self.start_button.configure(state="normal")
            self.stop_button.configure(state="disabled")
            self.progress_bar.stop()
            self.progress_bar.set(0)
            self.scraper = None
            self.scraper_thread = None

def main():
    root = ctk.CTk()
    app = FetchWallpaperGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()