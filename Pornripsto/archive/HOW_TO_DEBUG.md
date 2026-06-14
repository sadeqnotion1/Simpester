# How to Debug the Extension

## Finding the Service Worker Console

The scraping happens in the **background service worker**, not in the popup. Here's how to see the logs:

### Step-by-Step:

1. **Open a new tab** and go to:
   ```
   chrome://extensions/
   ```

2. **Find the extension** called "PornRips Scraper (Standalone)"

3. **Look for** "Inspect views" text with a blue **"service worker"** link next to it

4. **Click** the blue **"service worker"** link

5. A **new DevTools window** will open - this is the background console!

### What You Should See:

When scraping is working, you'll see logs like:
```
Scraping: Movie_Title_1080p
[TORRENT] Found: https://pornrips.to/wp-content/uploads/torrents/file.torrent
[DOWNLOAD] Starting download: Movie_Title_1080p.torrent from https://...
[DOWNLOAD] Fetched blob: 12345 bytes, type: application/x-bittorrent
[DOWNLOAD] Success: Movie_Title_1080p.torrent (ID: 123)
[SCREENSHOTS] Found 10 pixhost links
[SCREENSHOT 1] Processing: https://pixhost.to/show/...
[DOWNLOAD] Starting download: Movie_Title_1080p_1.jpg
[DOWNLOAD] Fetched blob: 524288 bytes, type: image/jpeg
[DOWNLOAD] Success: Movie_Title_1080p_1.jpg (ID: 124)
```

## Visual Guide:

### Where to Click:

```
chrome://extensions/ page:

┌─────────────────────────────────────────────┐
│ PornRips Scraper (Standalone)               │
│ Version 2.0.0                               │
│                                             │
│ Inspect views                               │
│ ↓ Click this blue link:                     │
│ service worker  ← CLICK HERE                │
└─────────────────────────────────────────────┘
```

### If "service worker" link is not visible:

The service worker might be inactive. To activate it:

1. Go to pornrips.to
2. Click the extension icon
3. Click any scraping button
4. Now go back to `chrome://extensions/`
5. The "service worker" link should appear

OR

Click **"Reload"** button on the extension card, then try again.

## Two Different Consoles:

### 1. Popup Console (What you opened)
- Right-click extension icon → Inspect popup
- Shows only UI-related logs
- **NOT where scraping logs appear**

### 2. Service Worker Console (What you need)
- `chrome://extensions/` → Click "service worker"
- Shows all scraping, downloading, and processing logs
- **This is where all the action is!**

## Quick Test:

1. Open service worker console
2. Go to pornrips.to
3. Open extension popup
4. Click "Current Page" button
5. Watch the service worker console - you should see logs appearing!

## Troubleshooting:

### "Service worker" link disappeared
- The worker goes inactive after 30 seconds of no activity
- Start a scraping job to wake it up
- Or click the extension reload button

### No logs appearing even in service worker console
- Check that you clicked "Current Page" or "Scrape All"
- Make sure you're on pornrips.to
- Check that the date filter matches today's date
- Try refreshing the extension

### Errors appearing
- Read the error message carefully
- Common issues:
  - Network errors → Check internet connection
  - CORS errors → Should be fixed with blob downloads
  - 404 errors → Link might be broken
  - Permission errors → Check downloads permission

## Expected Behavior:

✅ **Working correctly:**
- Service worker console shows `[DOWNLOAD]` messages
- Files appear in Downloads folder
- Progress bar updates in popup

❌ **Not working:**
- Service worker console shows errors
- No `[DOWNLOAD]` messages appear
- Files don't download

## Still Need Help?

After checking the service worker console:

1. Take a screenshot of any errors
2. Note what messages appear (or don't appear)
3. Check if downloads permission is granted
4. Try the test download code from TROUBLESHOOTING.md
