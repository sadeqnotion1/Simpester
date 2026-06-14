// Minimal test service worker
console.log('🔥 SERVICE WORKER LOADED! 🔥');

chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ Extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message);
  sendResponse({ status: 'working', message: 'Service worker is alive!' });
  return true;
});

console.log('🎯 Service worker setup complete');
