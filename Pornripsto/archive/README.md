# PornRips Scraper - Browser Extension

A standalone browser extension for scraping pornrips.to content. **No Python, no servers, no setup required!**

Just load the extension and start downloading torrents and screenshots directly from your browser.

## ✨ Features

- 🚀 **Fully Standalone** - No Python, no backend server, just load and go
- 🎯 **Visual Selection** - Click on posts to add them to your queue
- 📅 **Date Filtering** - Scrape all content from a specific date
- 🎬 **Resolution Filter** - Choose 480p, 720p, 1080p, or 2160p
- 💾 **Auto Downloads** - Torrents and screenshots download automatically
- 📊 **Progress Tracking** - Real-time progress updates
- 🔄 **Error Recovery** - Retry failed screenshot downloads
- 💻 **Cross-Browser** - Works in Chrome and Edge

## 📦 Installation

### Chrome
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `extension` folder

### Microsoft Edge
1. Download or clone this repository
2. Open Edge and navigate to `edge://extensions/`
3. Enable **Developer mode** (toggle in bottom left)
4. Click **Load unpacked**
5. Select the `extension` folder

That's it! No other dependencies or setup needed.

## 🚀 Quick Start

1. **Navigate to pornrips.to**
2. **Click the extension icon** in your browser toolbar
3. **Select a date** using the date picker (defaults to today)
4. **Choose resolutions** you want (1080p is selected by default)
5. **Click a scraping button**:
   - **Current Page** - Scrape all visible movies on current page
   - **Scrape All** - Scrape all movies from selected date
   - **Selection Mode** - Manually select individual movies
6. **Watch the progress bar** - Downloads start automatically!

## 📂 Where Files Are Saved

All downloads go to your browser's default download folder:

```
[Downloads]/pornrips_scraper/
├── Movie_Title_1080p.torrent
├── Movie_Title_1080p_1.jpg
├── Movie_Title_1080p_2.jpg
├── Movie_Title_1080p_3.jpg
└── ...
```

## 🎯 Scraping Modes

### 1. Current Page
Quickly scrape all movies visible on your current page.
- Fast and convenient
- Respects your resolution filter
- Great for grabbing a few specific items

### 2. Scrape All (Date Filter)
Scrape all movies from a specific date automatically.
- Choose a date with the date picker
- Extension crawls up to 5 pages
- Filters by your selected resolutions
- Perfect for daily downloads

### 3. Selection Mode
Manually pick individual movies.
1. Click **Enable Selection Mode**
2. Click on movie posts (they'll highlight purple)
3. Selected items appear in your queue
4. Click **Scrape Selected** when ready
5. Use **Clear Selection** to start over

## 🔧 Resolution Filter

Choose which video qualities to download:
- ✅ **480p** - Lower quality, smaller files
- ✅ **720p** - HD quality
- ✅ **1080p** - Full HD (recommended, default)
- ✅ **2160p** - 4K quality

Select multiple resolutions to download various qualities. Only movies matching your selections will be scraped.

## ⚠️ Error Handling

Sometimes screenshot downloads fail (broken links, expired images, etc.):

1. **Failed downloads are tracked** - A warning appears in the extension
2. **View error details** - Click "Show Error Log" to see what failed
3. **Retry easily** - Click "Retry Failed Screenshots" to try again
4. **Errors persist** - Your error log survives even if you close the popup

## 🔒 Privacy & Security

This extension:
- ✅ Runs 100% locally in your browser
- ✅ No external servers or APIs
- ✅ No data collection or tracking
- ✅ Only accesses pornrips.to and pixhost.to when you scrape
- ✅ All downloads stay on your machine
- ✅ Open source - inspect the code yourself

## 🛠️ Troubleshooting

### Downloads not starting
- Make sure you granted download permissions when prompted
- Check your browser's download settings
- Open browser console (F12) and check for errors

### Selection mode not working
- Ensure you're on a pornrips.to listing page
- Try refreshing the page
- Disable and re-enable selection mode

### Screenshots failing to download
- This is normal - some pixhost links expire or break
- Use the "Retry Failed Screenshots" button
- Check the error log for details

### Extension not appearing
- Make sure Developer Mode is enabled
- Try removing and re-adding the extension
- Check that you selected the `extension` folder (not the parent folder)

## 📋 Permissions Explained

The extension requests these permissions:

| Permission | Why It's Needed |
|------------|----------------|
| `storage` | Save your queue and preferences |
| `activeTab` | Read content from pornrips.to |
| `scripting` | Inject selection mode UI |
| `downloads` | Save torrents and screenshots |
| `pornrips.to/*` | Access the website for scraping |
| `pixhost.to/*` | Download full-size screenshots |

## 🏗️ Project Structure

```
pornrips-scraper/
├── extension/              # The browser extension
│   ├── manifest.json       # Extension configuration
│   ├── popup.html          # Main UI
│   ├── popup.css           # Styling
│   ├── popup.js            # UI logic
│   ├── content.js          # Selection mode
│   ├── content.css         # Selection styling
│   ├── background.js       # Scraping engine
│   ├── icon*.png           # Extension icons
│   └── README.md           # Extension docs
└── README.md               # This file
```

## 🤝 Contributing

Found a bug? Have a feature request? Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## ⚖️ Legal Notice

This tool is for **educational and personal use only**.

- Respect the website's terms of service
- Don't abuse or overload their servers
- Use responsibly and ethically
- The authors are not responsible for misuse

## 📄 License

This project is open source and available for personal use.

## 🌟 Credits

Built with ❤️ for the community. No tracking, no ads, no BS.

---

**Ready to start?** Load the extension and visit pornrips.to! 🎬
