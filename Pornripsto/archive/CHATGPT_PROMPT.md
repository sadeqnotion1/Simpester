# Prompt for ChatGPT - Chrome Extension Download Issues

Copy and paste this entire prompt to ChatGPT:

---

I have a Chrome Manifest V3 browser extension that scrapes a website and downloads files (torrents and images). The extension scrapes successfully but **files are not downloading**.

## Current Setup

**Extension Type:** Chrome Manifest V3 (service worker based)

**Permissions in manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "PornRips Scraper (Standalone)",
  "version": "2.0.0",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "downloads"
  ],
  "host_permissions": [
    "https://pornrips.to/*",
    "https://pixhost.to/*",
    "https://*.pixhost.to/*"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

## The Problem

1. Extension scrapes correctly (can see it processing pages)
2. Progress bar updates in popup
3. BUT no files actually download
4. Service worker shows as "(inactive)" in chrome://extensions/
5. Clicking "service worker (inactive)" does NOT open DevTools console
6. No logs appear anywhere

## My Download Function

```javascript
// Download file using chrome.downloads API
async function downloadFile(url, filename) {
  try {
    console.log(`[DOWNLOAD] Starting download: ${filename} from ${url}`);

    // Fetch the file first (to handle CORS and get the blob)
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Get the blob
    const blob = await response.blob();
    console.log(`[DOWNLOAD] Fetched blob: ${blob.size} bytes, type: ${blob.type}`);

    // Create object URL from blob
    const blobUrl = URL.createObjectURL(blob);

    // Download using chrome.downloads API
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: blobUrl,
        filename: `pornrips_scraper/${filename}`,
        conflictAction: 'uniquify',
        saveAs: false
      }, (downloadId) => {
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

        if (chrome.runtime.lastError) {
          console.error(`[DOWNLOAD] Error: ${chrome.runtime.lastError.message}`);
          reject(chrome.runtime.lastError);
        } else {
          console.log(`[DOWNLOAD] Success: ${filename} (ID: ${downloadId})`);
          resolve(downloadId);
        }
      });
    });
  } catch (error) {
    console.error(`[DOWNLOAD] Failed to download ${filename}:`, error);
    throw error;
  }
}
```

## How I Call It

In the service worker's scraping function:

```javascript
// Download torrent
const torrentUrl = "https://example.com/file.torrent";
await downloadFile(torrentUrl, "Movie_Title.torrent");

// Download screenshot
const imageUrl = "https://img.pixhost.to/images/123/image.jpg";
await downloadFile(imageUrl, "Movie_Title_1.jpg");
```

## What I've Tried

1. ✅ Downloads permission is in manifest
2. ✅ Extension is enabled in chrome://extensions/
3. ✅ Tried reloading the extension
4. ✅ No errors in popup console
5. ❌ Can't access service worker console (clicking inactive link does nothing)
6. ❌ No files appear in Downloads folder

## Questions

1. **Why won't the service worker DevTools open?** Clicking "service worker (inactive)" does nothing.

2. **Is my download function correct for Manifest V3 service workers?** I fetch as blob first, then create object URL, then download.

3. **How can I debug this if the service worker console won't open?**

4. **Do I need any additional permissions or configuration?**

5. **Is there a better way to download files in a Manifest V3 extension?**

6. **Could the service worker being inactive be preventing downloads?**

## Expected Behavior

When scraping starts:
- Service worker should activate
- Files should download to `Downloads/pornrips_scraper/`
- Console logs should appear
- chrome.downloads.download() should work

## Browser Info

- Browser: Chrome/Edge (Chromium-based)
- Manifest Version: 3
- Extension Type: Service Worker (not background page)

---

**Please help me figure out:**
1. Why downloads aren't working
2. How to access/debug the service worker console
3. If my download code is correct for Manifest V3
4. Any alternative approaches to make this work

Thank you!
