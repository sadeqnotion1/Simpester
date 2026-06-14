# Debug Instructions - See What's Happening

## I Added Debug Logs - Here's How to See Them

### Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Click **reload button** (🔄) on "PornRips Scraper (Standalone)"

### Step 2: Open BOTH Consoles

**A) Service Worker Console** (for scraping logs)
- Go to `chrome://inspect/#service-workers`
- Find "PornRips Scraper (Standalone)"
- Click **"inspect"**
- Keep this window open!

**B) Popup Console** (for button clicks)
- Go to pornrips.to
- Click extension icon
- Right-click inside the popup → **"Inspect"**
- Go to **Console** tab
- Keep this window open too!

### Step 3: Try Scraping

Now you have TWO console windows open. Watch both!

#### Option A: "Scrape All" Button

1. Click **"Scrape All"** in popup
2. **In POPUP console**, you should see:
   ```
   [POPUP] Scrape All clicked - Date: 2025-12-29, Resolutions: [...]
   [POPUP] Sending message to background: {...}
   [POPUP] Received response: {...}
   ```

3. **In SERVICE WORKER console**, you should see:
   ```
   Background received message: {action: 'startScrape', params: {...}}
   Scraping: Movie_Title_1080p
   [TORRENT] Found: https://...
   [DOWNLOAD] Starting download: ...
   [DOWNLOAD] Success: ...
   ```

#### Option B: "Current Page" → "Scrape Selected"

1. Click **"Current Page"** first
2. **In POPUP console**, you should see:
   ```
   [POPUP] Current Page clicked
   [POPUP] Extracting page data with resolutions: [...]
   [POPUP] Extracted items: [...]
   [POPUP] Added to queue. Total items: 5
   ```

3. Then click **"Scrape Selected"** (the button with the queue count)
4. **In POPUP console**, you should see:
   ```
   [POPUP] Starting scrape selected, queue: [...]
   [POPUP] Sending message to background: {...}
   [POPUP] Received response: {...}
   ```

5. **In SERVICE WORKER console**, you should see:
   ```
   Background received message: {action: 'startScrape', params: {...}}
   Scraping: Movie_Title_1080p
   [DOWNLOAD] Starting download: ...
   ```

## What to Look For

### ✅ Working (what you SHOULD see):

**Popup Console:**
```
[POPUP] Scrape All clicked
[POPUP] Sending message to background: {action: 'startScrape', ...}
[POPUP] Received response: {success: true, jobId: 'job_1', ...}
```

**Service Worker Console:**
```
Background received message: {action: 'startScrape', ...}
Scraping: Movie_Title_1080p
[DOWNLOAD] Starting download: Movie_Title.torrent
[DOWNLOAD] Success: Movie_Title.torrent (ID: 123)
```

### ❌ Not Working (problems):

**If popup console shows:**
```
[POPUP] Error: Could not establish connection
```
→ Service worker is crashed. Reload extension.

**If popup console shows:**
```
[POPUP] Received response: undefined
```
→ Background isn't responding. Check service worker console for errors.

**If service worker console shows nothing:**
→ Message not reaching background. Reload extension.

**If service worker shows message but no scraping:**
→ Check for errors in the scraping code. Look for red error messages.

## Quick Checklist

Before testing:
- [ ] Extension reloaded
- [ ] Service worker console open (`chrome://inspect/#service-workers`)
- [ ] Popup console open (right-click popup → Inspect)
- [ ] On pornrips.to website
- [ ] Date is set to today
- [ ] 1080p resolution is checked

Then click either:
- [ ] "Scrape All" button (scrapes by date)
- [ ] "Current Page" → then "Scrape Selected" (scrapes visible items)

## Tell Me What You See

After you try it, tell me:
1. **In popup console** - Did you see `[POPUP] Sending message` ?
2. **In service worker console** - Did you see `Background received message` ?
3. **In service worker console** - Did you see `Scraping: Movie_Title` ?
4. **In service worker console** - Did you see `[DOWNLOAD] Starting download` ?
5. **Any errors?** - Copy and paste them

This will tell us exactly where it's failing!
