// PornRips Zip Downloader Dashboard Logic

document.addEventListener('DOMContentLoaded', () => {
  // Tab Switching
  const btnQueue = document.getElementById('tab-btn-queue');
  const btnLogs = document.getElementById('tab-btn-logs');
  const contentQueue = document.getElementById('tab-queue-content');
  const contentLogs = document.getElementById('tab-logs-content');

  btnQueue.addEventListener('click', () => {
    btnQueue.classList.add('active');
    btnLogs.classList.remove('active');
    contentQueue.style.display = 'block';
    contentLogs.style.display = 'none';
  });

  btnLogs.addEventListener('click', () => {
    btnLogs.classList.add('active');
    btnQueue.classList.remove('active');
    contentLogs.style.display = 'block';
    contentQueue.style.display = 'none';
  });

  // Logger helper
  function log(message, type = 'info') {
    const consoleEl = document.getElementById('pr-logs-console');
    if (!consoleEl) return;
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleEl.appendChild(entry);
    consoleEl.scrollTop = consoleEl.scrollHeight;
    console.log(`[LOG - ${type}] ${message}`);
  }

  // Global variables
  let targetDateUrl = '';
  let matchedPosts = [];
  let isRunning = false;
  let downloadedBytes = 0;
  let totalFilesCount = 0;

  // Sanitizes a string for filenames
  const sanitizeFilename = (filename) => {
    return filename.replace(/[<>:"/\\|?*]/g, '_');
  };

  // Format bytes helper
  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Dynamic fetch with customized Referer spoofing to bypass hotlink protection
  async function fetchWithReferer(url, refererUrl) {
    if (chrome.declarativeNetRequest) {
      try {
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [1],
          addRules: [
            {
              id: 1,
              priority: 1,
              action: {
                type: "modifyHeaders",
                requestHeaders: [
                  {
                    header: "Referer",
                    operation: "set",
                    value: refererUrl
                  },
                  {
                    header: "Origin",
                    operation: "remove"
                  }
                ]
              },
              condition: {
                urlFilter: "||pixhost.to"
              }
            }
          ]
        });
      } catch (err) {
        log(`Failed updating session rules: ${err.message}`, 'warn');
      }
    }
    return fetch(url);
  }
  // Detect Date/URL query parameter or Active Tab URL
  const urlParams = new URLSearchParams(window.location.search);
  const sourceTabId = parseInt(urlParams.get('tabId'), 10) || null;

  // Fetch image utilizing context scripting inside the source tab as the primary bypass
  async function fetchImageWithFallback(url, showPageUrl, tabId) {
    if (tabId) {
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: async (fetchUrl) => {
            try {
              const res = await fetch(fetchUrl);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const blob = await res.blob();
              return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve({ success: true, base64: reader.result });
                reader.onerror = () => resolve({ success: false, error: 'Read error' });
                reader.readAsDataURL(blob);
              });
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
          args: [url]
        });

        if (result && result[0] && result[0].result && result[0].result.success) {
          const base64Data = result[0].result.base64;
          const response = await fetch(base64Data);
          return response;
        } else {
          const errReason = result && result[0] && result[0].result ? result[0].result.error : 'Unknown error';
          log(`Tab context fetch returned error: ${errReason}. Using fallback.`, 'warn');
        }
      } catch (err) {
        log(`Tab context fetch scripting failed: ${err.message}. Using fallback.`, 'warn');
      }
    }
    // Fallback: Spoof headers via DeclarativeNetRequest session rules
    return fetchWithReferer(url, showPageUrl);
  }
  // Detect Date/URL query parameter or Active Tab URL
  const inputEl = document.getElementById('pr-target-input');
  const btnDetect = document.getElementById('pr-btn-detect');
  const btnStart = document.getElementById('pr-btn-start');

  // Check active rules for diagnostics
  if (chrome.declarativeNetRequest) {
    chrome.declarativeNetRequest.getSessionRules((rules) => {
      log(`Active Network Spoofing Rules: ${JSON.stringify(rules)}`, 'info');
    });
  } else {
    log('chrome.declarativeNetRequest is undefined!', 'err');
  }

  // Try parsing target from query parameter
  const paramTarget = urlParams.get('target');
  if (paramTarget) {
    inputEl.value = paramTarget;
    detectAndCrawl(paramTarget);
  } else {
    // Attempt auto-detection
    detectActiveTab();
  }

  btnDetect.addEventListener('click', detectActiveTab);
  btnStart.addEventListener('click', startZipDownload);

  async function detectActiveTab() {
    log('Querying active tabs to detect PornRips date page...', 'info');
    chrome.tabs.query({ active: false }, (tabs) => {
      // Find the first tab containing pornrips date URL pattern
      const dateTab = tabs.find(t => t.url && t.url.match(/pornrips\.to\/\d{4}\/\d{2}\/\d{2}/));
      if (dateTab) {
        log(`Detected active PornRips tab: ${dateTab.url}`, 'success');
        inputEl.value = dateTab.url;
        detectAndCrawl(dateTab.url);
      } else {
        // Query active tab in current window as fallback
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
          const currentTab = activeTabs[0];
          if (currentTab && currentTab.url && currentTab.url.includes('pornrips.to')) {
            log(`Detected current active tab: ${currentTab.url}`, 'success');
            inputEl.value = currentTab.url;
            detectAndCrawl(currentTab.url);
          } else {
            log('No PornRips tab found. Please paste the URL manually.', 'warn');
          }
        });
      }
    });
  }

  // Parse target date url
  function getBaseDateUrl(url) {
    const match = url.match(/^(https:\/\/pornrips\.to\/\d{4}\/\d{2}\/\d{2})/);
    return match ? `${match[1]}/` : null;
  }

  // Triggered when target URL is loaded/detected
  async function detectAndCrawl(url) {
    const baseUrl = getBaseDateUrl(url);
    if (!baseUrl) {
      log('Target URL is not a valid PornRips date archive page (e.g. /YYYY/MM/DD/)', 'err');
      return;
    }
    targetDateUrl = baseUrl;
    log(`Normalized Target Date URL: ${targetDateUrl}`, 'info');
    
    // Begin scanning index pages
    await crawlAllIndexPages();
  }

  // Helper to parse matched 1080p posts from raw HTML
  function parsePostsFromHtml(html, pageNum) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const postsRaw = Array.from(doc.querySelectorAll('article.post'));
    
    return postsRaw.map((post) => {
      const titleEl = post.querySelector('h2.entry-title a');
      return {
        page: pageNum,
        title: titleEl ? titleEl.textContent.trim() : 'Unknown Movie',
        url: titleEl ? titleEl.href : null,
        status: 'idle',
        torrentUrl: null,
        screenshots: []
      };
    }).filter(p => p.url && p.title.toLowerCase().includes('1080p'));
  }

  // Background crawling of date index and pagination (Page 1, 2, 3, etc.)
  async function crawlAllIndexPages() {
    log('Scanning date index pages for 1080p videos...', 'info');
    matchedPosts = [];
    updateQueueUI();

    let page = 1;
    let keepCrawling = true;

    while (keepCrawling && page <= 10) {
      const pageUrl = page === 1 ? targetDateUrl : `${targetDateUrl}page/${page}/`;
      log(`Crawling index page ${page}...`, 'info');
      
      try {
        const res = await fetch(pageUrl);
        if (!res.ok) {
          log(`Index crawling stopped at page ${page} (HTTP status ${res.status})`, 'info');
          break;
        }
        
        const html = await res.text();
        const pagePosts = parsePostsFromHtml(html, page);
        
        if (pagePosts.length === 0) {
          log(`No matching 1080p posts found on page ${page}. Stopping.`, 'info');
          break;
        }
        
        matchedPosts = matchedPosts.concat(pagePosts);
        log(`Resolved ${pagePosts.length} matches from page ${page}`, 'success');
        
        updateQueueUI();
        page++;
        
        // Anti-throttle delay
        await new Promise(r => setTimeout(r, 400));
      } catch (e) {
        log(`Failed index crawling on page ${page}: ${e.message}`, 'err');
        break;
      }
    }

    // Set final indexes
    matchedPosts.forEach((post, i) => {
      post.index = i + 1;
    });

    updateQueueUI();
    log(`Crawl completed. Found ${matchedPosts.length} video posts matching 1080p.`, 'success');
    
    if (matchedPosts.length > 0) {
      btnStart.disabled = false;
    }
  }

  // Update UI list for Queue
  function updateQueueUI() {
    const listEl = document.getElementById('pr-queue-list');
    const queueCount = document.getElementById('pr-queue-count');
    queueCount.textContent = matchedPosts.length;

    if (matchedPosts.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p>No matching 1080p videos loaded yet.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    matchedPosts.forEach((post) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'queue-item';
      itemEl.id = `pr-q-item-${post.index}`;
      
      // Determine dot status class
      let dotClass = 'q-detail-dot';
      if (post.status === 'success') dotClass += ' active';
      else if (post.status === 'error') dotClass += ' error';
      else if (post.status === 'fetching' || post.status === 'zipping' || post.status === 'crawling') dotClass += ' pending';

      itemEl.innerHTML = `
        <div class="queue-row">
          <span class="queue-title" title="${post.title}">P${post.page} | ${post.title}</span>
          <span class="queue-status q-status-${post.status}">${post.status}</span>
        </div>
        <div class="queue-details">
          <div class="q-detail-item">
            <span class="${dotClass}"></span>
            <span>Torrent: ${post.torrentUrl ? 'Resolved' : 'Pending'}</span>
          </div>
          <div class="q-detail-item">
            <span class="q-detail-dot ${post.screenshots.length > 0 ? 'active' : ''}"></span>
            <span>Screenshots: ${post.screenshots.length || 'Pending'}</span>
          </div>
        </div>
      `;
      listEl.appendChild(itemEl);
    });
  }

  // Scrape detail contents for a specific video post
  async function scrapeDetailPage(post) {
    try {
      const res = await fetch(post.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Fetch torrent URL
      const torrentEl = doc.querySelector('a[href$=".torrent"]');
      if (torrentEl) {
        post.torrentUrl = torrentEl.href;
      }

      // Fetch screenshots
      const entryContent = doc.querySelector('div.entry-content');
      if (entryContent) {
        const links = entryContent.querySelectorAll('a[href*="pixhost"]');
        links.forEach((link, idx) => {
          const img = link.querySelector('img');
          const thumbUrl = img ? img.src : '';
          const showPageUrl = link.href;

          // Convert to full URL
          let fullUrl = null;
          if (thumbUrl) {
            const match = thumbUrl.match(/https?:\/\/t(\d+)\.pixhost\.to\/thumbs\/(\d+)\/(.+)/i);
            if (match) {
              fullUrl = `https://img${match[1]}.pixhost.to/images/${match[2]}/${match[3]}`;
            }
          }
          if (!fullUrl && showPageUrl) {
            const match = showPageUrl.match(/https?:\/\/pixhost\.to\/show\/(\d+)\/(.+)/i);
            if (match) {
              fullUrl = `https://img1.pixhost.to/images/${match[1]}/${match[2]}`;
            }
          }

          post.screenshots.push({
            index: idx + 1,
            thumbUrl,
            showPageUrl,
            fullUrl
          });
        });
      }
      return true;
    } catch (e) {
      log(`Error scraping detail page for ${post.title}: ${e.message}`, 'err');
      return false;
    }
  }

  // Process the full queue and pack files inside a JSZip instance
  async function startZipDownload() {
    if (isRunning) return;
    isRunning = true;

    // Reset status trackers
    downloadedBytes = 0;
    totalFilesCount = 0;

    // Update global controls
    btnStart.disabled = true;
    btnDetect.disabled = true;
    inputEl.disabled = true;

    const globalStatus = document.getElementById('pr-global-status');
    globalStatus.className = 'status-badge running';
    globalStatus.textContent = 'Running';

    const progressSection = document.getElementById('pr-progress-section');
    const progressFill = document.getElementById('pr-progress-bar-fill');
    const progressLabel = document.getElementById('pr-progress-label');
    const progressPercent = document.getElementById('pr-progress-percent');
    const statsCard = document.getElementById('pr-stats-card');

    progressSection.style.display = 'block';
    statsCard.style.display = 'block';

    log('Initializing ZIP archive zipping queue...', 'info');
    const zip = new JSZip();

    // Create a metadata txt file in the ZIP root
    const dateStr = targetDateUrl.match(/\/(\d{4}\/\d{2}\/\d{2})\//)[1];
    zip.file('info.txt', `PornRips Date Scraper Export\nDate: ${dateStr}\nExtracted on: ${new Date().toLocaleString()}\nTotal Movies: ${matchedPosts.length}\n`);

    let processedCount = 0;

    // Iterate through video queue
    for (const post of matchedPosts) {
      post.status = 'fetching';
      updateQueueUI();
      log(`Processing Movie ${post.index}/${matchedPosts.length}: ${post.title}`, 'info');

      // 1. Scrape details
      const detailOk = await scrapeDetailPage(post);
      if (!detailOk) {
        post.status = 'error';
        updateQueueUI();
        processedCount++;
        continue;
      }

      // Create folder inside zip
      const movieFolderName = sanitizeFilename(post.title);
      const movieFolder = zip.folder(movieFolderName);
      let localFileCount = 0;

      // 2. Fetch & Zip Torrent file
      if (post.torrentUrl) {
        log(`Fetching torrent for: ${post.title}`, 'info');
        progressLabel.textContent = `Fetching Torrent for video ${post.index}...`;
        try {
          const res = await fetch(post.torrentUrl);
          if (res.ok) {
            const buf = await res.arrayBuffer();
            const filename = `${movieFolderName}.torrent`;
            movieFolder.file(filename, buf);
            
            downloadedBytes += buf.byteLength;
            localFileCount++;
            totalFilesCount++;
            updateStatsUI(processedCount);
          } else {
            log(`Failed fetching torrent file: HTTP ${res.status}`, 'warn');
          }
        } catch (e) {
          log(`Network error fetching torrent: ${e.message}`, 'err');
        }
      }

      // 3. Fetch & Zip Pixhost screenshots (Bypassing CORS since we run in Extension scope!)
      if (post.screenshots.length > 0) {
        log(`Downloading ${post.screenshots.length} screenshots for: ${post.title}`, 'info');
        let imgIndex = 1;

        for (const img of post.screenshots) {
          if (!img.fullUrl) continue;
          progressLabel.textContent = `Downloading Image ${imgIndex}/${post.screenshots.length} for video ${post.index}...`;
          
          try {
            const res = await fetchImageWithFallback(img.fullUrl, img.showPageUrl, sourceTabId);
            if (res.ok) {
              const buf = await res.arrayBuffer();
              const filename = `${movieFolderName}_${img.index}.jpg`;
              movieFolder.file(filename, buf);
              
              downloadedBytes += buf.byteLength;
              localFileCount++;
              totalFilesCount++;
              updateStatsUI(processedCount);
            } else {
              log(`Failed fetching screenshot #${imgIndex}: HTTP ${res.status}`, 'warn');
            }
          } catch (e) {
            log(`Network error fetching image #${imgIndex}: ${e.message}`, 'err');
          }
          imgIndex++;
          // Tiny delay between image requests
          await new Promise(r => setTimeout(r, 200));
        }
      }

      post.status = 'success';
      updateQueueUI();
      log(`Completed zipping directory for Movie: ${post.title} (Added ${localFileCount} assets)`, 'success');
      
      processedCount++;
      const percent = Math.floor((processedCount / matchedPosts.length) * 100);
      progressFill.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      
      // Delay before next movie fetch
      await new Promise(r => setTimeout(r, 450));
    }

    // 4. Generate final Zip File
    log('Asset downloads complete. Building final ZIP archive...', 'info');
    globalStatus.className = 'status-badge zipping';
    globalStatus.textContent = 'Zipping';
    progressLabel.textContent = 'Generating ZIP Archive...';
    document.getElementById('pr-stat-zip').textContent = 'Compressing...';

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        const zipPercent = Math.floor(metadata.percent);
        progressFill.style.width = `${zipPercent}%`;
        progressPercent.textContent = `${zipPercent}%`;
        progressLabel.textContent = `Compressing ZIP file (${zipPercent}%)...`;
      });

      log('ZIP archive compression complete. Triggering downloads API...', 'success');
      document.getElementById('pr-stat-zip').textContent = 'Complete';
      document.getElementById('pr-stat-size').textContent = formatBytes(zipBlob.size);

      const downloadFilename = `PornRips_${dateStr.replace(/\//g, '_')}.zip`;
      const zipUrl = URL.createObjectURL(zipBlob);

      chrome.downloads.download({
        url: zipUrl,
        filename: downloadFilename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          log(`Downloads API error: ${chrome.runtime.lastError.message}`, 'err');
        } else {
          log(`Download triggered successfully! ID: ${downloadId}`, 'success');
          showToast('ZIP file download started!');
        }
        URL.revokeObjectURL(zipUrl);
      });
      
      globalStatus.className = 'status-badge complete';
      globalStatus.textContent = 'Complete';
      progressLabel.textContent = 'Export completed successfully!';
    } catch (zipErr) {
      log(`Error generating ZIP file: ${zipErr.message}`, 'err');
      globalStatus.className = 'status-badge';
      globalStatus.textContent = 'Failed';
      document.getElementById('pr-stat-zip').textContent = 'Failed';
    }

    isRunning = false;
    btnStart.disabled = false;
    btnDetect.disabled = false;
    inputEl.disabled = false;
  }

  // Update Left-Panel Stats UI
  function updateStatsUI(processedFolders) {
    document.getElementById('pr-stat-folders').textContent = `${processedFolders}/${matchedPosts.length}`;
    document.getElementById('pr-stat-files').textContent = totalFilesCount;
    document.getElementById('pr-stat-size').textContent = formatBytes(downloadedBytes);
  }

  // Diagnostic Tester Code
  const btnTest = document.getElementById('pr-btn-test');
  const testImg = document.getElementById('pr-test-img');
  const testStatus = document.getElementById('pr-test-status');
  const testPlaceholder = document.getElementById('pr-test-placeholder');

  btnTest.addEventListener('click', async () => {
    // Find the first post with a screenshot
    const postWithImg = matchedPosts.find(p => p.screenshots && p.screenshots.length > 0);
    if (!postWithImg) {
      testStatus.textContent = "⚠️ Please load/craw a PornRips date page first to resolve screenshots!";
      testStatus.style.color = "var(--warning-color)";
      return;
    }

    const testItem = postWithImg.screenshots[0];
    if (!testItem || !testItem.fullUrl) {
      testStatus.textContent = "⚠️ Found video but no screenshots resolved.";
      testStatus.style.color = "var(--warning-color)";
      return;
    }

    testStatus.textContent = `Testing fetch on: ${testItem.fullUrl}...`;
    testStatus.style.color = "var(--info-color)";
    testImg.style.display = "none";
    testPlaceholder.style.display = "block";
    testPlaceholder.textContent = "Loading image...";

    try {
      log(`[TEST] Fetching screenshot: ${testItem.fullUrl}`, 'info');
      const res = await fetchImageWithFallback(testItem.fullUrl, testItem.showPageUrl, sourceTabId);
      if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
      const blob = await res.blob();
      
      log(`[TEST] Successfully fetched blob size: ${blob.size} bytes`, 'info');
      
      const blobUrl = URL.createObjectURL(blob);
      testImg.src = blobUrl;
      testImg.style.display = "block";
      testPlaceholder.style.display = "none";

      if (blob.size < 15000) {
        testStatus.textContent = `⚠️ Warning: Downloaded blob is small (${(blob.size/1024).toFixed(1)} KB). It might be the Blocked Placeholder! Inspect the image below.`;
        testStatus.style.color = "var(--error-color)";
      } else {
        testStatus.textContent = `✅ Success! Downloaded image is ${(blob.size/1024).toFixed(1)} KB. Verify that you see the movie screenshot preview below!`;
        testStatus.style.color = "var(--success-color)";
      }
    } catch (e) {
      testStatus.textContent = `❌ Test Failed: ${e.message}`;
      testStatus.style.color = "var(--error-color)";
      testPlaceholder.textContent = "Test Failed";
      log(`[TEST] Failed: ${e.message}`, 'err');
    }
  });

  // Toast Notification helper
  function showToast(message) {
    let toast = document.getElementById('pr-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pr-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
});
