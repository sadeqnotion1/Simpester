// Content script for PornRips Scraper Extension
// Runs on pornrips.to pages

let selectionMode = false;
let selectedItems = new Set();

// Initialize
init();

function init() {
  console.log('PornRips Scraper Extension loaded');
  loadSelectedItems();
  setupMessageListener();
}

// Load selected items from storage
async function loadSelectedItems() {
  const result = await chrome.storage.local.get(['queue']);
  const queue = result.queue || [];

  queue.forEach(item => {
    selectedItems.add(item.url);
  });

  updateVisualSelection();
}

// Setup message listener
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleSelection') {
      toggleSelectionMode(message.enabled);
    } else if (message.action === 'clearSelection') {
      clearAllSelection();
    }
  });
}

// Toggle selection mode
function toggleSelectionMode(enabled) {
  selectionMode = enabled;

  const posts = document.querySelectorAll('article.post');

  posts.forEach(post => {
    if (enabled) {
      post.classList.add('scraper-selectable');
      post.addEventListener('click', handlePostClick);
    } else {
      post.classList.remove('scraper-selectable');
      post.removeEventListener('click', handlePostClick);
    }
  });

  updateVisualSelection();

  // Show notification
  showNotification(enabled ? 'Selection mode enabled - Click items to select' : 'Selection mode disabled');
}

// Handle post click
function handlePostClick(e) {
  if (!selectionMode) return;

  e.preventDefault();
  e.stopPropagation();

  const post = e.currentTarget;
  const titleElem = post.querySelector('h2.entry-title a');
  const dateElem = post.querySelector('time.entry-date');

  if (!titleElem) return;

  const title = titleElem.textContent.trim();

  // Filter: only allow 720p and 1080p
  if (!title.includes('720p') && !title.includes('1080p')) {
    showNotification('Skipped: Only 720p and 1080p are downloaded');
    return;
  }

  const item = {
    title: title,
    url: titleElem.href,
    date: dateElem ? dateElem.getAttribute('datetime') : null
  };

  // Toggle selection
  if (selectedItems.has(item.url)) {
    selectedItems.delete(item.url);
    post.classList.remove('scraper-selected');
    chrome.runtime.sendMessage({ action: 'removeFromQueue', url: item.url });
    showNotification('Removed from queue');
  } else {
    selectedItems.add(item.url);
    post.classList.add('scraper-selected');
    chrome.runtime.sendMessage({ action: 'addToQueue', item });
    showNotification('Added to queue');
  }
}

// Update visual selection
function updateVisualSelection() {
  const posts = document.querySelectorAll('article.post');

  posts.forEach(post => {
    const titleElem = post.querySelector('h2.entry-title a');
    if (titleElem && selectedItems.has(titleElem.href)) {
      post.classList.add('scraper-selected');
    } else {
      post.classList.remove('scraper-selected');
    }
  });
}

// Clear all selection
function clearAllSelection() {
  selectedItems.clear();
  updateVisualSelection();
  showNotification('Selection cleared');
}

// Show notification
function showNotification(message) {
  // Remove existing notifications
  const existing = document.querySelector('.scraper-notification');
  if (existing) {
    existing.remove();
  }

  // Create notification
  const notification = document.createElement('div');
  notification.className = 'scraper-notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  // Animate in
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

// Handle page mutations (for dynamically loaded content)
const observer = new MutationObserver(() => {
  if (selectionMode) {
    toggleSelectionMode(true);
  }
  updateVisualSelection();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
