/**
 * Facebook Reels Auto-Scroll - Background Service Worker
 * Manages extension state, commands, and badge notifications.
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  scrollDelay: 0.0,          // Delay in seconds after video ends (0 = instant)
  skipSponsored: true,        // Automatically skip sponsored/ad reels
  pauseOnComments: true,      // Pause auto-scroll when comments are opened or typing
  soundNotification: false,   // Subtle audio cue on reel transition
  loopCurrentReel: false,     // Temporarily loop current reel
  autoUnmute: true            // Automatically enable sound on load & scroll
};

// Initialize default settings upon installation
chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await chrome.storage.local.get(null);
  const settingsToSet = {};

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (current[key] === undefined) {
      settingsToSet[key] = value;
    }
  }

  // If previous version saved legacy scrollDelay of 1.0, migrate to 0.0
  if (current.scrollDelay === 1.0) {
    settingsToSet.scrollDelay = 0.0;
  }

  if (Object.keys(settingsToSet).length > 0) {
    await chrome.storage.local.set(settingsToSet);
  }

  const enabled = current.enabled !== undefined ? current.enabled : DEFAULT_SETTINGS.enabled;
  updateBadge(enabled);
});

// Update toolbar action badge
function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#10B981" }); // Emerald green
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#64748B" }); // Slate grey
  }
}

// Listen for keyboard command (e.g. Alt+Shift+D)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle_autoscroll") {
    const data = await chrome.storage.local.get({ enabled: true });
    const newEnabled = !data.enabled;
    await chrome.storage.local.set({ enabled: newEnabled });
    updateBadge(newEnabled);

    // Notify all active Facebook tabs
    const tabs = await chrome.tabs.query({ url: "*://*.facebook.com/*" });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: "STATE_CHANGED",
        settings: { enabled: newEnabled }
      }).catch(() => {
        // Tab might not have content script injected yet, ignore error
      });
    }
  }
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "UPDATE_BADGE") {
    updateBadge(Boolean(message.enabled));
    sendResponse({ success: true });
  }
  return true;
});

// Sync badge if storage changes from popup
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.enabled !== undefined) {
    updateBadge(changes.enabled.newValue);
  }
});
