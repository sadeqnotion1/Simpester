# Troubleshooting Downloads

## Downloads Not Working?

If the extension scrapes but doesn't download files, follow these steps:

### 1. Check Browser Console

1. **Right-click the extension icon** → Select "Inspect popup" or "Inspect"
2. Go to the **Console** tab
3. Look for download messages starting with `[DOWNLOAD]`, `[TORRENT]`, or `[SCREENSHOT]`

**What to look for:**
- ✅ `[DOWNLOAD] Starting download:` - Download is attempting
- ✅ `[DOWNLOAD] Fetched blob: X bytes` - File was fetched successfully
- ✅ `[DOWNLOAD] Success:` - Download completed
- ❌ `[DOWNLOAD] Error:` - Download failed (read the error message)
- ❌ `[DOWNLOAD] Failed to download:` - Network or CORS issue

### 2. Check Download Permissions

1. When you first start scraping, Chrome should prompt you to **allow downloads**
2. If you didn't see this prompt or clicked "Block":
   - Right-click extension icon → **Manage extension**
   - Scroll to **Site access** or **Permissions**
   - Make sure **Downloads** is enabled

### 3. Check Browser Downloads Settings

1. Open Chrome Settings (`chrome://settings/`)
2. Go to **Downloads** section
3. Make sure:
   - ✅ Download location is set
   - ✅ "Ask where to save each file before downloading" is **OFF** (optional but recommended)
   - ✅ Your download folder has write permissions

### 4. Check Service Worker Console

The scraping happens in the background service worker:

1. Go to `chrome://extensions/`
2. Find "PornRips Scraper (Standalone)"
3. Click **"service worker"** link (it might say "Inspect views")
4. This opens the **background console** where all scraping logs appear

**Look for these logs:**
```
[TORRENT] Found: https://...
[TORRENT] Downloaded: Movie_Title.torrent
[SCREENSHOTS] Found 10 pixhost links
[SCREENSHOT 1] Processing: https://pixhost.to/...
[DOWNLOAD] Starting download: Movie_Title_1.jpg
[DOWNLOAD] Fetched blob: 524288 bytes
[DOWNLOAD] Success: Movie_Title_1.jpg (ID: 123)
```

### 5. Common Issues & Solutions

#### Issue: "Network request failed" or CORS errors
**Solution:** The extension now fetches files as blobs first to bypass CORS. If still failing:
- Check your internet connection
- The source URL might be broken or expired
- Try the "Retry Failed Screenshots" button

#### Issue: Downloads permission denied
**Solution:**
1. Remove and re-add the extension
2. When prompted, click **"Allow"** for downloads
3. Check `chrome://extensions/` → Extension details → Permissions

#### Issue: Files downloading but can't find them
**Solution:**
- Check your browser's Downloads folder
- Look for subfolder: `pornrips_scraper/`
- Check `chrome://downloads/` to see download history

#### Issue: "Service worker inactive"
**Solution:**
1. Go to `chrome://extensions/`
2. Find the extension
3. Toggle it off and on again
4. Or click the refresh icon

#### Issue: Only torrents download, no screenshots
**Solution:**
- Check the service worker console for pixhost errors
- Pixhost links might be expired or broken
- Use "Retry Failed Screenshots" button
- Check error log in extension popup

### 6. Test Downloads Manually

To verify downloads work at all:

1. Open extension popup
2. Open browser DevTools (F12)
3. Go to Console tab
4. Try this test code:
```javascript
chrome.downloads.download({
  url: 'https://via.placeholder.com/150',
  filename: 'test_image.png',
  saveAs: false
}, (id) => {
  console.log('Download ID:', id);
});
```

If this works, the extension's download permission is fine.

### 7. Check Download Location

Your files should be in:
```
[Your Downloads Folder]/pornrips_scraper/
```

For example:
- Windows: `C:\Users\YourName\Downloads\pornrips_scraper\`
- Mac: `/Users/YourName/Downloads/pornrips_scraper/`
- Linux: `/home/yourname/Downloads/pornrips_scraper/`

### 8. Enable Verbose Logging

All logs are already enabled in the latest version. Check:
- Service worker console (main logs)
- Popup console (UI logs)

### 9. Still Not Working?

1. **Reload the extension:**
   - `chrome://extensions/` → Click refresh icon on extension

2. **Check manifest permissions:**
   - Open `extension/manifest.json`
   - Verify `"downloads"` is in the permissions array

3. **Try a different browser:**
   - Test in Edge or Brave (Chromium-based)
   - This helps identify browser-specific issues

4. **Check for errors:**
   - Any red errors in service worker console?
   - Screenshot and report them

### 10. Report the Issue

If still broken, gather this info:
- Browser name and version
- What you see in service worker console
- Any error messages
- Does the test download (step 6) work?

## Success Indicators

When downloads work correctly, you'll see:

**In Service Worker Console:**
```
[DOWNLOAD] Starting download: Movie_Title.torrent from https://...
[DOWNLOAD] Fetched blob: 12345 bytes, type: application/x-bittorrent
[DOWNLOAD] Success: Movie_Title.torrent (ID: 456)
```

**In Extension Popup:**
- Progress bar moving
- Status text updating
- No error warnings

**In Downloads Folder:**
- New `pornrips_scraper/` folder
- `.torrent` files appearing
- `.jpg` screenshot files appearing

---

## Quick Checklist

- [ ] Extension installed and enabled
- [ ] Downloads permission granted
- [ ] Service worker console shows `[DOWNLOAD]` logs
- [ ] No red errors in console
- [ ] Browser download folder accessible
- [ ] Internet connection working
- [ ] Visited pornrips.to and started scraping

If all checked ✅ and still no downloads, check the service worker console for specific error messages!
