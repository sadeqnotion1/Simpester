# PornRips Scraper - Standalone Browser Extension

A standalone Chrome/Edge browser extension for scraping pornrips.to content. **No Python required!**

## Features

- **Fully Standalone**: All scraping logic runs directly in the browser extension
- **Select Individual Posts**: Click on posts to add them to your queue
- **Scrape Current Page**: Quickly grab all items from the page you're viewing
- **Date-Based Scraping**: Filter and scrape content by specific dates
- **Resolution Filtering**: Choose which video resolutions to download (480p, 720p, 1080p, 2160p)
- **Automatic Downloads**: Torrents and screenshots are automatically downloaded to your browser's download folder
- **Error Handling**: Failed screenshot downloads are tracked and can be retried
- **Progress Tracking**: Real-time progress updates for all scraping operations

## Installation

### Chrome
1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `extension` folder from this project

### Microsoft Edge
1. Open Edge browser
2. Navigate to `edge://extensions/`
3. Enable "Developer mode" (toggle in bottom left)
4. Click "Load unpacked"
5. Select the `extension` folder from this project

## Usage

1. **Navigate to pornrips.to**
2. **Click the extension icon** to open the control panel
3. **Choose your scraping method**:
   - **Current Page**: Scrape all items visible on the current page
   - **Selection Mode**: Manually select specific posts to scrape
   - **Scrape All**: Scrape all items from a specific date (use the date picker)
4. **Select resolutions**: Choose which video qualities you want (default: 1080p)
5. **Click the corresponding button** to start scraping
6. **Monitor progress** in the extension popup
7. **Files download automatically** to your browser's download folder in a `pornrips_scraper` subfolder

## File Downloads

All downloaded files are saved to:
```
[Your Downloads Folder]/pornrips_scraper/
├── Movie_Title_1080p.torrent
├── Movie_Title_1080p_1.jpg
├── Movie_Title_1080p_2.jpg
└── ...
```

## Scraping Modes

### Current Page
Scrapes all movies from the page you're currently viewing. Great for quick downloads of visible content.

### Selection Mode
1. Click "Enable Selection Mode"
2. Click on individual movie posts to add them to your queue
3. Selected posts will be highlighted in purple
4. Click "Scrape Selected" when ready
5. Use "Clear Selection" to remove all selected items

### Scrape All (Date Filter)
1. Choose a date using the date picker
2. Select desired resolutions
3. Click "Scrape All" to download all matching content from that date
4. The extension will automatically crawl up to 5 pages

## Error Recovery

If any screenshots fail to download:
1. A warning will appear in the extension popup showing the number of failures
2. Click "Show Error Log" to see detailed error information
3. Click "Retry Failed Screenshots" to attempt downloading them again
4. Failed downloads are tracked per job and persist even if you close the popup

## Resolution Filter

Choose which video qualities to download:
- **480p**: Lower quality, smaller file size
- **720p**: HD quality
- **1080p**: Full HD (recommended, default)
- **2160p**: 4K quality

You can select multiple resolutions. Only movies matching your selected resolutions will be downloaded.

## Permissions Explained

- **storage**: Save your queue and preferences
- **activeTab**: Access the current pornrips.to tab
- **scripting**: Inject selection UI into pages
- **downloads**: Save torrents and screenshots to your computer
- **host_permissions**: Access pornrips.to and pixhost.to for scraping

## Privacy & Security

This extension:
- ✅ Runs entirely locally in your browser
- ✅ Does not collect or transmit any personal data
- ✅ Only accesses pornrips.to and pixhost.to when you initiate scraping
- ✅ Does not require external servers or internet services
- ✅ All downloads stay on your machine

## Troubleshooting

### Downloads not starting
- Check that you've granted download permissions when prompted
- Verify your browser's download settings allow automatic downloads
- Check the browser console (F12) for any error messages

### Selection mode not working
- Make sure you're on a pornrips.to page with movie listings
- Try refreshing the page
- Disable and re-enable selection mode

### Some screenshots fail to download
- This is normal - some pixhost links may be broken or expired
- Use the "Retry Failed Screenshots" button
- Check the error log for specific failure reasons

## File Structure

```
extension/
├── manifest.json      # Extension configuration
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic & UI
├── content.js         # Selection mode logic
├── content.css        # Selection mode styles
├── background.js      # Scraping engine
├── README.md          # This file
└── icon*.png          # Extension icons
```

## Development

To modify the extension:
1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension
4. Test your changes

## How It Works

1. **User Interface**: The popup (popup.html/js) provides the control panel
2. **Content Script**: Runs on pornrips.to pages to enable selection mode
3. **Background Worker**: Handles all scraping logic, fetches pages, downloads files
4. **Chrome Downloads API**: Saves torrents and screenshots to your computer

No external servers or Python required!
