// Background worker for PornRips Zip Downloader extension
// In MV3, when the action icon is clicked, open the dashboard in a new tab.

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: `dashboard.html?target=${encodeURIComponent(tab.url || '')}&tabId=${tab.id}` });
});

// Setup net request rules to spoof Referer and remove Origin for Pixhost hotlink bypass
async function setupRefererSpoofing() {
  const rules = [
    {
      id: 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          {
            header: "Referer",
            operation: "set",
            value: "https://pixhost.to/"
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
  ];

  try {
    // Session rules reset on browser restart, so we establish them on startup
    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: [1],
      addRules: rules
    });
    console.log("✅ [BACKGROUND] DeclarativeNetRequest session rules configured successfully");
  } catch (err) {
    console.error("❌ [BACKGROUND] Failed configuring declarativeNetRequest rules:", err);
  }
}

// Call on startup
setupRefererSpoofing();
