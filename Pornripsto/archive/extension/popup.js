// Popup script for PornRips Scraper Extension (Standalone Mode)

let queue = [];
let selectionMode = false;
let currentJobId = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Set today's date as default for specific date picker
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  document.getElementById('specificDate').value = `${year}-${month}-${day}`;

  await loadQueue();
  updateUI();
  setupEventListeners();

  // Resume active job if exists
  await resumeActiveJob();
});

// Load queue from storage
async function loadQueue() {
  const result = await chrome.storage.local.get(['queue']);
  queue = result.queue || [];
}

// Save queue to storage
async function saveQueue() {
  await chrome.storage.local.set({ queue });
  updateUI();
}

// Get selected resolutions from checkboxes
function getSelectedResolutions() {
  const resolutions = [];
  if (document.getElementById('res480p').checked) resolutions.push('480p');
  if (document.getElementById('res720p').checked) resolutions.push('720p');
  if (document.getElementById('res1080p').checked) resolutions.push('1080p');
  if (document.getElementById('res2160p').checked) resolutions.push('2160p');
  return resolutions;
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('scrapeCurrentPage').addEventListener('click', scrapeCurrentPage);
  document.getElementById('scrapeSelected').addEventListener('click', scrapeSelected);
  document.getElementById('scrapeByDate').addEventListener('click', scrapeByDate);
  document.getElementById('toggleSelection').addEventListener('click', toggleSelectionMode);
  document.getElementById('clearSelection').addEventListener('click', clearSelection);
  document.getElementById('clearQueue').addEventListener('click', clearQueue);
  document.getElementById('retryScreenshots').addEventListener('click', retryFailedScreenshots);
  document.getElementById('toggleErrorLog').addEventListener('click', toggleErrorLog);

  // Resolution chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const checkbox = chip.querySelector('input[type="checkbox"]');
      checkbox.checked = !checkbox.checked;
      chip.classList.toggle('active', checkbox.checked);
    });
  });

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'progressUpdate') {
      updateProgress(message.progress, message.status);
    } else if (message.action === 'jobComplete') {
      handleJobComplete(message);
    } else if (message.action === 'jobFailed') {
      handleJobFailed(message);
    }
  });
}

// Scrape current page
async function scrapeCurrentPage() {
  console.log('[POPUP] Current Page clicked');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes('pornrips.to')) {
    showMessage('Please navigate to pornrips.to first');
    return;
  }

  const resolutions = getSelectedResolutions();
  const selectedDate = document.getElementById('specificDate').value;
  console.log('[POPUP] Extracting page data with resolutions:', resolutions, 'date:', selectedDate);

  // Inject content script and get page data
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractCurrentPageData,
    args: [resolutions, selectedDate]
  });

  const pageData = results[0].result;
  console.log('[POPUP] Extracted items:', pageData.items);

  if (pageData.items.length === 0) {
    showMessage('No items matching date filter on current page');
    return;
  }

  // Add to queue
  queue.push(...pageData.items);
  await saveQueue();
  showMessage(`Added ${pageData.items.length} items to queue - Click "Scrape Selected" to start!`);
  console.log('[POPUP] Added to queue. Total items:', queue.length);
}

// Function injected into page to extract data
function extractCurrentPageData(resolutions, selectedDate) {
  const items = [];
  const posts = document.querySelectorAll('article.post');

  posts.forEach(post => {
    const titleElem = post.querySelector('h2.entry-title a');
    const dateElem = post.querySelector('time.entry-date');

    if (titleElem) {
      const title = titleElem.textContent.trim();

      // Check if title matches any selected resolution
      const matchesResolution = resolutions.length === 0 || resolutions.some(res => title.includes(res));

      if (matchesResolution) {
        const postDateStr = dateElem ? dateElem.getAttribute('datetime') : null;

        // Filter by date if selected
        if (selectedDate && postDateStr) {
          const postDate = new Date(postDateStr).toISOString().split('T')[0];
          if (postDate !== selectedDate) {
            console.log(`[FILTER] Skipping ${title.substring(0, 40)}... (date ${postDate} !== ${selectedDate})`);
            return; // Skip this post
          }
        }

        items.push({
          title: title,
          url: titleElem.href,
          date: postDateStr
        });
      }
    }
  });

  return { items };
}

// Scrape selected items
async function scrapeSelected() {
  if (queue.length === 0) {
    showMessage('No items selected. Use selection mode to pick items.');
    return;
  }

  try {
    console.log('[POPUP] Starting scrape selected, queue:', queue);
    updateProgress(0, 'Starting scrape...');

    const message = {
      action: 'startScrape',
      params: {
        items: queue,
        mode: 'selected',
        resolutions: getSelectedResolutions()
      }
    };
    console.log('[POPUP] Sending message to background:', message);

    const response = await chrome.runtime.sendMessage(message);
    console.log('[POPUP] Received response:', response);

    if (response && response.success) {
      currentJobId = response.jobId;
      await chrome.storage.local.set({ activeJobId: currentJobId });
      showMessage(`Scraping started!`);
      clearQueueItems();
    } else {
      showMessage('Error starting scrape');
      console.error('[POPUP] Scrape failed:', response);
    }
  } catch (error) {
    console.error('[POPUP] Error:', error);
    showMessage('Error: ' + error.message);
  }
}

// Scrape by date range
async function scrapeByDate() {
  const specificDate = document.getElementById('specificDate').value;

  if (!specificDate) {
    showMessage('Please select a date first');
    return;
  }

  // Use specific date only (single day)
  const startDate = specificDate;
  const endDate = specificDate;
  const maxPages = 5; // Default to 5 pages

  console.log(`[POPUP] Scrape All clicked - Date: ${specificDate}, Resolutions:`, getSelectedResolutions());

  try {
    updateProgress(0, 'Starting scrape...');

    const message = {
      action: 'startScrape',
      params: {
        startDate: startDate,
        endDate: endDate,
        maxPages: parseInt(maxPages),
        mode: 'date_range',
        resolutions: getSelectedResolutions()
      }
    };
    console.log('[POPUP] Sending message to background:', message);

    const response = await chrome.runtime.sendMessage(message);
    console.log('[POPUP] Received response:', response);

    if (response && response.success) {
      currentJobId = response.jobId;
      await chrome.storage.local.set({ activeJobId: currentJobId });
      showMessage(`Scraping started!`);
    } else {
      showMessage('Error starting scrape');
      console.error('[POPUP] Scrape failed:', response);
    }
  } catch (error) {
    console.error('[POPUP] Error:', error);
    showMessage('Error: ' + error.message);
  }
}

// Toggle selection mode
async function toggleSelectionMode() {
  selectionMode = !selectionMode;
  const btn = document.getElementById('toggleSelection');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes('pornrips.to')) {
    showMessage('Please navigate to pornrips.to first');
    selectionMode = false;
    return;
  }

  // Send message to content script
  chrome.tabs.sendMessage(tab.id, {
    action: 'toggleSelection',
    enabled: selectionMode
  });

  btn.textContent = selectionMode ? 'Disable Selection Mode' : 'Enable Selection Mode';
  btn.classList.toggle('btn-primary', selectionMode);
  btn.classList.toggle('btn-outline', !selectionMode);
}

// Clear selection
async function clearSelection() {
  // Clear the queue
  queue = [];
  await saveQueue();

  // Also clear visual selection on the page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab.url.includes('pornrips.to')) {
    chrome.tabs.sendMessage(tab.id, { action: 'clearSelection' });
  }

  showMessage('Selection cleared');
}

// Clear queue
async function clearQueue() {
  queue = [];
  await saveQueue();
}

function clearQueueItems() {
  queue = [];
  saveQueue();
}

// Update UI
function updateUI() {
  document.getElementById('queueCount').textContent = queue.length;
  document.getElementById('selectedCount').textContent = queue.length;

  const queueList = document.getElementById('queueList');

  if (queue.length === 0) {
    queueList.innerHTML = '<p class="empty-message">No items in queue</p>';
  } else {
    queueList.innerHTML = queue.map((item, index) => `
      <div class="queue-item">
        <span class="queue-item-title" title="${item.title}">${item.title}</span>
        <button class="queue-item-remove" data-index="${index}">×</button>
      </div>
    `).join('');

    // Add remove listeners
    queueList.querySelectorAll('.queue-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        queue.splice(index, 1);
        saveQueue();
      });
    });
  }
}

// Update progress
function updateProgress(percent, text) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  progressBar.style.width = `${percent}%`;
  // Show both percentage and status in the progress text
  progressText.textContent = `${percent}% - ${text}`;
}

// Handle job complete event from background
async function handleJobComplete(message) {
  await chrome.storage.local.remove('activeJobId');

  if (message.failedScreenshotCount > 0) {
    await showRetrySection(message.failedScreenshotCount, message.jobId);
    showMessage(`Scraping complete! ${message.failedScreenshotCount} screenshots failed - click Retry to try again.`);
  } else {
    hideRetrySection();
    showMessage('Scraping complete!');
  }
}

// Handle job failed event from background
async function handleJobFailed(message) {
  await chrome.storage.local.remove('activeJobId');
  showMessage(`Scraping failed: ${message.error}`);
}

// Resume active job if popup was closed and reopened
async function resumeActiveJob() {
  // Check for failed job with screenshots to retry
  const failedJobResult = await chrome.storage.local.get(['failedJobId']);
  if (failedJobResult.failedJobId) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getProgress',
        jobId: failedJobResult.failedJobId
      });

      if (response && !response.error && response.failedScreenshotCount > 0) {
        showRetrySection(response.failedScreenshotCount, failedJobResult.failedJobId);
      } else {
        await chrome.storage.local.remove('failedJobId');
      }
    } catch (error) {
      // Keep the failed job ID for later
    }
  }

  const result = await chrome.storage.local.get(['activeJobId']);
  if (result.activeJobId) {
    currentJobId = result.activeJobId;
    // Job state is managed by background script, we just track the ID
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getProgress',
        jobId: result.activeJobId
      });

      if (response && !response.error) {
        updateProgress(response.progress, response.status);

        if (response.progress >= 100 || response.status === 'complete' || response.status === 'failed') {
          await chrome.storage.local.remove('activeJobId');

          if (response.failedScreenshotCount > 0) {
            showRetrySection(response.failedScreenshotCount, result.activeJobId);
          }
        }
      } else {
        await chrome.storage.local.remove('activeJobId');
      }
    } catch (error) {
      await chrome.storage.local.remove('activeJobId');
    }
  }
}

// Show retry section with failed screenshot count
async function showRetrySection(failedCount, jobId) {
  console.log('[DEBUG] showRetrySection called with:', failedCount, jobId);

  const retrySection = document.getElementById('retrySection');
  const failedText = document.getElementById('failedScreenshotText');

  if (!retrySection) {
    console.error('[ERROR] retrySection element not found!');
    return;
  }

  if (!failedText) {
    console.error('[ERROR] failedScreenshotText element not found!');
    return;
  }

  failedText.textContent = `${failedCount} screenshot${failedCount > 1 ? 's' : ''} failed to download`;
  retrySection.style.display = 'block';

  console.log('[DEBUG] Retry section displayed, style:', retrySection.style.display);

  // Store job ID for retry
  await chrome.storage.local.set({ failedJobId: jobId });

  // Fetch and display error details
  await loadErrorLog(jobId);
}

// Load and display error log
async function loadErrorLog(jobId) {
  console.log('[DEBUG] Loading error log for job:', jobId);
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getProgress',
      jobId: jobId
    });

    if (response && !response.error) {
      console.log('[DEBUG] Error log data:', response.failedScreenshots);
      if (response.failedScreenshots && response.failedScreenshots.length > 0) {
        displayErrorLog(response.failedScreenshots);
      } else {
        console.log('[DEBUG] No failed screenshots in response');
      }
    } else {
      console.error('[ERROR] Failed to fetch error log');
    }
  } catch (error) {
    console.error('[ERROR] Error loading error log:', error);
  }
}

// Display error log in UI
function displayErrorLog(failedScreenshots) {
  console.log('[DEBUG] Displaying error log with', failedScreenshots.length, 'errors');

  const errorLog = document.getElementById('errorLog');
  if (!errorLog) {
    console.error('[ERROR] errorLog element not found!');
    return;
  }

  errorLog.innerHTML = '';

  failedScreenshots.forEach((error, index) => {
    console.log('[DEBUG] Adding error item:', error);
    const errorItem = document.createElement('div');
    errorItem.className = 'error-item';
    errorItem.innerHTML = `
      <div class="error-item-title">
        <i class="fas fa-times-circle"></i>
        ${error.title} - Screenshot #${error.index}
      </div>
      <div class="error-item-message">Error: ${error.error}</div>
      <div class="error-item-url">${error.show_page_url}</div>
    `;
    errorLog.appendChild(errorItem);
  });

  console.log('[DEBUG] Error log populated with', errorLog.children.length, 'items');
}

// Toggle error log visibility
function toggleErrorLog() {
  const errorLogContainer = document.getElementById('errorLogContainer');
  const toggleText = document.getElementById('toggleErrorLogText');

  if (errorLogContainer.style.display === 'none') {
    errorLogContainer.style.display = 'block';
    toggleText.textContent = 'Hide Error Log';
  } else {
    errorLogContainer.style.display = 'none';
    toggleText.textContent = 'Show Error Log';
  }
}

// Hide retry section
function hideRetrySection() {
  const retrySection = document.getElementById('retrySection');
  retrySection.style.display = 'none';
  chrome.storage.local.remove('failedJobId');
}

// Retry failed screenshots
async function retryFailedScreenshots() {
  const result = await chrome.storage.local.get(['failedJobId']);

  if (!result.failedJobId) {
    showMessage('No failed screenshots to retry');
    return;
  }

  try {
    updateProgress(0, 'Starting retry...');

    const response = await chrome.runtime.sendMessage({
      action: 'retryScreenshots',
      jobId: result.failedJobId
    });

    if (response.success) {
      showMessage(`Retrying ${response.retryCount} failed screenshots...`);
      currentJobId = response.jobId;
      await chrome.storage.local.set({ activeJobId: currentJobId });

      // Hide retry section while retrying
      hideRetrySection();
    } else {
      showMessage(`Error: ${response.error || 'Failed to retry'}`);
    }
  } catch (error) {
    showMessage('Error: ' + error.message);
  }
}

// Show message
function showMessage(msg) {
  updateProgress(0, msg);
  setTimeout(() => {
    updateProgress(0, 'Ready');
  }, 3000);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addToQueue') {
    queue.push(message.item);
    saveQueue();
  } else if (message.action === 'removeFromQueue') {
    const index = queue.findIndex(item => item.url === message.url);
    if (index !== -1) {
      queue.splice(index, 1);
      saveQueue();
    }
  }
});
