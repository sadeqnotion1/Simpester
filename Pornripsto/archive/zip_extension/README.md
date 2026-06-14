# PornRips Zip Downloader (1080p Only)

A standalone Manifest V3 Chrome Extension that scrapes all **1080p** videos from any date archive page on `pornrips.to`, resolves their torrent links and full-resolution screenshot links, downloads all of them in the background (exempt from CORS restrictions), structures them into folders for each video, and bundles everything into a single `.zip` file.

## ✨ Features

- 📂 **Auto-Structured:** Creates a separate folder for each video inside the ZIP containing its `.torrent` file and images.
- ⚡ **Zero CORS Blocks:** Because the script runs in the extension window scope with declared host permissions, it fetches files from `pornrips.to` and `pixhost.to` directly without any browser blocks!
- 📦 **Single Download:** No more multiple prompts or messy download histories—just one single `.zip` download.
- 🔍 **Auto-Pagination Indexer:** Automatically scans the target date's subpages (`/page/2/`, `/page/3/`, etc.) to find all 1080p movies.
- 📊 **Real-time Dashboard:** Includes a gorgeous, interactive dark-themed dashboard showing progress bars, overall size, resolved files, queue status, and system console logs.

## 📦 Installation & Setup

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** in the top-left.
4. Select the `zip_extension` folder in this repository.

## 🚀 How to Use It

1. Browse to any date page on `pornrips.to` (e.g. `https://pornrips.to/2026/06/03/`).
2. Click the **PornRips Zip Downloader** extension icon in your toolbar.
3. A new dashboard tab will open, auto-detecting the date page and crawling all pagination pages for 1080p videos.
4. Click **🚀 Start Bulk Download**.
5. Watch the dashboard process the queue. When finished, it will compile and trigger the download of your `.zip` archive!
