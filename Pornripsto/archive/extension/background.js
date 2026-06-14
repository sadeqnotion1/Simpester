// Background service worker for PornRips Scraper Extension
// Standalone version - all scraping logic runs in the extension

console.log('🔥 [BACKGROUND] Starting to load...');

// Job storage
const jobs = {};
let jobIdCounter = 0;

console.log('✅ [BACKGROUND] Variables initialized');

class ScraperJob {
  constructor(jobId, params) {
    this.jobId = jobId;
    this.params = params;
    this.progress = 0;
    this.status = 'starting';
    this.result = null;
    this.error = null;
    this.startedAt = new Date();
    this.completedAt = null;
    this.failedScreenshots = [];
  }

  updateProgress(progress, status) {
    this.progress = progress;
    this.status = status;
    // Notify popup of progress update
    chrome.runtime.sendMessage({
      action: 'progressUpdate',
      jobId: this.jobId,
      progress: this.progress,
      status: this.status
    }).catch(() => {}); // Ignore errors if popup is closed
  }

  complete(result) {
    this.progress = 100;
    this.status = 'complete';
    this.result = result;
    this.completedAt = new Date();
    // Notify popup
    chrome.runtime.sendMessage({
      action: 'jobComplete',
      jobId: this.jobId,
      result: this.result,
      failedScreenshotCount: this.failedScreenshots.length
    }).catch(() => {});
  }

  fail(error) {
    this.status = 'failed';
    this.error = error.toString();
    this.completedAt = new Date();
    // Notify popup
    chrome.runtime.sendMessage({
      action: 'jobFailed',
      jobId: this.jobId,
      error: this.error
    }).catch(() => {});
  }

  addFailedScreenshot(screenshotInfo) {
    this.failedScreenshots.push(screenshotInfo);
  }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('PornRips Scraper Extension installed (Standalone Mode)');
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  // Ping for service worker activation (debugging)
  if (message.type === 'ping' || message.action === 'ping') {
    console.log('[SERVICE WORKER] Ping received - worker is awake!');
    sendResponse({ status: 'awake' });
    return true;
  }

  if (message.action === 'startScrape') {
    handleStartScrape(message.params).then(sendResponse);
    return true; // Keep channel open for async response
  } else if (message.action === 'getProgress') {
    handleGetProgress(message.jobId).then(sendResponse);
    return true;
  } else if (message.action === 'retryScreenshots') {
    handleRetryScreenshots(message.jobId).then(sendResponse);
    return true;
  }

  return true;
});

// Start a scraping job
async function handleStartScrape(params) {
  const jobId = `job_${++jobIdCounter}`;
  const job = new ScraperJob(jobId, params);
  jobs[jobId] = job;

  // Start scraping asynchronously
  if (params.mode === 'selected') {
    scrapeSelectedItems(job, params.items, params.resolutions);
  } else if (params.mode === 'date_range') {
    scrapeDateRange(job, params);
  }

  return {
    success: true,
    jobId: jobId,
    message: 'Scraping job started'
  };
}

// Get job progress
async function handleGetProgress(jobId) {
  const job = jobs[jobId];
  if (!job) {
    return { error: 'Job not found' };
  }

  return {
    jobId: jobId,
    progress: job.progress,
    status: job.status,
    startedAt: job.startedAt.toISOString(),
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    error: job.error,
    failedScreenshots: job.failedScreenshots,
    failedScreenshotCount: job.failedScreenshots.length
  };
}

// Retry failed screenshots
async function handleRetryScreenshots(jobId) {
  const job = jobs[jobId];
  if (!job) {
    return { error: 'Job not found' };
  }

  if (job.failedScreenshots.length === 0) {
    return { error: 'No failed screenshots to retry' };
  }

  const retryJobId = `job_${++jobIdCounter}`;
  const retryJob = new ScraperJob(retryJobId, { mode: 'retry', parentJobId: jobId });
  jobs[retryJobId] = retryJob;

  const failedToRetry = [...job.failedScreenshots];
  retryFailedScreenshots(retryJob, failedToRetry, job);

  return {
    success: true,
    jobId: retryJobId,
    retryCount: failedToRetry.length,
    message: `Retrying ${failedToRetry.length} failed screenshots`
  };
}

// Scrape selected items
async function scrapeSelectedItems(job, items, resolutions) {
  try {
    job.updateProgress(10, `Scraping ${items.length} items...`);

    let scrapedCount = 0;

    for (const item of items) {
      if (job.status === 'cancelled') break;

      await scrapeMoviePage(item.url, item.title, job);
      scrapedCount++;

      const progress = 10 + Math.floor((scrapedCount / items.length) * 90);
      job.updateProgress(progress, `Scraped ${scrapedCount}/${items.length} items`);
    }

    if (job.status !== 'cancelled') {
      const failedCount = job.failedScreenshots.length;
      let message = `Successfully scraped ${scrapedCount} items`;
      if (failedCount > 0) {
        message += ` (${failedCount} screenshot errors)`;
      }

      job.complete({
        totalItems: items.length,
        scrapedItems: scrapedCount,
        failedScreenshots: failedCount,
        message: message
      });
    }
  } catch (error) {
    job.fail(error);
  }
}

// Scrape by date range
async function scrapeDateRange(job, params) {
  try {
    job.updateProgress(10, 'Starting scrape by date range...');

    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);
    const maxPages = params.maxPages || 5;
    const resolutions = params.resolutions || [];

    let totalItems = 0;

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      if (job.status === 'cancelled') break;

      const movieLinks = await scrapeMainPage(pageNum, startDate, endDate, resolutions);

      if (movieLinks.length === 0) break;

      for (const [movieUrl, movieTitle] of movieLinks) {
        if (job.status === 'cancelled') break;

        await scrapeMoviePage(movieUrl, movieTitle, job);
        totalItems++;

        const progress = 10 + Math.floor((pageNum / maxPages) * 90);
        job.updateProgress(progress, `Scraped ${totalItems} items (page ${pageNum}/${maxPages})`);
      }
    }

    if (job.status !== 'cancelled') {
      const failedCount = job.failedScreenshots.length;
      let message = `Successfully scraped ${totalItems} items`;
      if (failedCount > 0) {
        message += ` (${failedCount} screenshot errors)`;
      }

      job.complete({
        totalItems: totalItems,
        failedScreenshots: failedCount,
        message: message
      });
    }
  } catch (error) {
    job.fail(error);
  }
}

// Scrape main page
async function scrapeMainPage(pageNum, startDate, endDate, resolutions) {
  const baseUrl = 'https://pornrips.to';
  const url = pageNum > 1 ? `${baseUrl}/page/${pageNum}/` : baseUrl;

  try {
    const response = await fetch(url);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const posts = doc.querySelectorAll('article.post');
    const movieLinks = [];

    for (const post of posts) {
      const titleElem = post.querySelector('h2.entry-title a');
      if (!titleElem) continue;

      const title = titleElem.textContent.trim();
      const href = titleElem.getAttribute('href');

      // Check resolution filter
      if (resolutions.length > 0) {
        const matchesResolution = resolutions.some(res => title.toLowerCase().includes(res.toLowerCase()));
        if (!matchesResolution) continue;
      }

      // Check date if available
      const dateElem = post.querySelector('time.entry-date');
      if (dateElem) {
        const dateStr = dateElem.getAttribute('datetime');
        if (dateStr) {
          const postDate = new Date(dateStr);
          const postDateOnly = new Date(postDate.getFullYear(), postDate.getMonth(), postDate.getDate());
          const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
          const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

          if (postDateOnly < startDateOnly || postDateOnly > endDateOnly) {
            continue;
          }
        }
      }

      movieLinks.push([href, title]);
    }

    return movieLinks;
  } catch (error) {
    console.error('Error scraping main page:', error);
    return [];
  }
}

// Scrape individual movie page
async function scrapeMoviePage(movieUrl, movieTitle, job) {
  try {
    console.log('Scraping:', movieTitle);

    const response = await fetch(movieUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Find torrent link
    const torrentLinks = doc.querySelectorAll('a[href$=".torrent"]');
    if (torrentLinks.length > 0) {
      const torrentHref = torrentLinks[0].getAttribute('href');
      // Make sure URL is absolute
      const torrentUrl = torrentHref.startsWith('http') ? torrentHref : new URL(torrentHref, movieUrl).href;
      console.log(`[TORRENT] Found: ${torrentUrl}`);

      // Download torrent
      try {
        await downloadFile(torrentUrl, `${sanitizeFilename(movieTitle)}.torrent`);
        console.log(`[TORRENT] Downloaded: ${movieTitle}.torrent`);
      } catch (error) {
        console.error(`[TORRENT] Failed to download: ${error.message}`);
        throw error;
      }
    } else {
      console.warn(`[TORRENT] No torrent link found for: ${movieTitle}`);
    }

    // Find screenshot images
    const entryContent = doc.querySelector('div.entry-content');
    if (entryContent) {
      const imgLinks = entryContent.querySelectorAll('a[href*="pixhost"]');
      console.log(`[SCREENSHOTS] Found ${imgLinks.length} pixhost links`);
      let screenshotIndex = 1;

      for (const link of imgLinks) {
        const img = link.querySelector('img');
        if (img) {
          const showPageUrl = link.getAttribute('href');
          console.log(`[SCREENSHOT ${screenshotIndex}] Processing: ${showPageUrl}`);

          try {
            const fullImgUrl = await getPixhostFullImage(showPageUrl);
            if (fullImgUrl) {
              const ext = getFileExtension(fullImgUrl) || '.jpg';
              const filename = `${sanitizeFilename(movieTitle)}_${screenshotIndex}${ext}`;
              console.log(`[SCREENSHOT ${screenshotIndex}] Downloading: ${filename}`);
              await downloadFile(fullImgUrl, filename);
              console.log(`[SCREENSHOT ${screenshotIndex}] ✓ Success`);
            } else {
              console.warn(`[SCREENSHOT ${screenshotIndex}] ✗ Could not extract image URL`);
              job.addFailedScreenshot({
                success: false,
                url: null,
                showPageUrl: showPageUrl,
                title: movieTitle,
                index: screenshotIndex,
                error: 'Failed to extract full-size image URL'
              });
            }
          } catch (error) {
            console.error(`[SCREENSHOT ${screenshotIndex}] ✗ Error: ${error.message}`);
            job.addFailedScreenshot({
              success: false,
              url: null,
              showPageUrl: showPageUrl,
              title: movieTitle,
              index: screenshotIndex,
              error: error.toString()
            });
          }
          screenshotIndex++;
        }
      }
    } else {
      console.warn(`[SCREENSHOTS] No entry-content div found for: ${movieTitle}`);
    }

    return true;
  } catch (error) {
    console.error('Error scraping movie page:', error);
    return false;
  }
}

// Get full-size image from pixhost
async function getPixhostFullImage(showPageUrl) {
  try {
    const response = await fetch(showPageUrl);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Method 1: Look for img with id="image"
    let img = doc.querySelector('img#image');
    if (img) {
      return img.getAttribute('src');
    }

    // Method 2: Look for img with class="image"
    img = doc.querySelector('img.image');
    if (img) {
      return img.getAttribute('src');
    }

    // Method 3: Convert thumbnail URL to full-size URL
    const thumbMatch = showPageUrl.match(/t\d+\.pixhost\.to\/thumbs\/(\d+)\/(.+)/);
    if (thumbMatch) {
      return `https://img1.pixhost.to/images/${thumbMatch[1]}/${thumbMatch[2]}`;
    }

    return null;
  } catch (error) {
    console.error('Error getting pixhost image:', error);
    return null;
  }
}

// Download file using chrome.downloads API
// Fixed: Use direct URL instead of blob (blob URLs don't work in service workers)
async function downloadFile(url, filename) {
  console.log(`[DOWNLOAD] Starting download: ${filename} from ${url}`);

  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: url,  // Use direct URL - browser handles CORS
      filename: `pornrips_scraper/${filename}`,
      conflictAction: 'uniquify',
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error(`[DOWNLOAD] Error: ${chrome.runtime.lastError.message}`);
        reject(chrome.runtime.lastError);
      } else {
        console.log(`[DOWNLOAD] Success: ${filename} (ID: ${downloadId})`);
        resolve(downloadId);
      }
    });
  });
}

// Sanitize filename
function sanitizeFilename(filename) {
  return filename.replace(/[<>:"/\\|?*]/g, '_');
}

// Get file extension from URL
function getFileExtension(url) {
  const match = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  return match ? `.${match[1]}` : null;
}

// Retry failed screenshots
async function retryFailedScreenshots(retryJob, failedScreenshots, originalJob) {
  try {
    retryJob.updateProgress(10, `Retrying ${failedScreenshots.length} screenshots...`);

    let successCount = 0;
    let stillFailed = [];

    for (let i = 0; i < failedScreenshots.length; i++) {
      const screenshot = failedScreenshots[i];

      try {
        const fullImgUrl = await getPixhostFullImage(screenshot.showPageUrl);
        if (fullImgUrl) {
          const ext = getFileExtension(fullImgUrl) || '.jpg';
          await downloadFile(fullImgUrl, `${sanitizeFilename(screenshot.title)}_${screenshot.index}${ext}`);
          successCount++;

          // Remove from original job's failed list
          const index = originalJob.failedScreenshots.findIndex(f =>
            f.showPageUrl === screenshot.showPageUrl && f.index === screenshot.index
          );
          if (index !== -1) {
            originalJob.failedScreenshots.splice(index, 1);
          }
        } else {
          stillFailed.push(screenshot);
        }
      } catch (error) {
        stillFailed.push({
          ...screenshot,
          error: error.toString()
        });
      }

      const progress = 10 + Math.floor(((i + 1) / failedScreenshots.length) * 90);
      retryJob.updateProgress(progress, `Retried ${i + 1}/${failedScreenshots.length} screenshots`);
    }

    // Update original job's failed screenshots
    originalJob.failedScreenshots = stillFailed;

    retryJob.complete({
      totalRetried: failedScreenshots.length,
      successCount: successCount,
      failedCount: stillFailed.length,
      message: `Successfully downloaded ${successCount}/${failedScreenshots.length} screenshots. ${stillFailed.length} still failed.`
    });
  } catch (error) {
    retryJob.fail(error);
  }
}

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Do nothing, just keep alive
  }
});

console.log('🎯 [BACKGROUND] Fully loaded and ready!');
