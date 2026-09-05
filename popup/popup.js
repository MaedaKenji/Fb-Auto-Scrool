/**
 * Facebook Reels Auto-Scroll - Popup Logic
 * Synchronizes user preferences with chrome.storage and broadcasts changes in real-time.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const masterCard = document.getElementById('masterCard');
  const masterToggle = document.getElementById('masterToggle');
  const masterStatus = document.getElementById('masterStatus');
  const headerPulse = document.getElementById('headerPulse');

  const delayRange = document.getElementById('delayRange');
  const delayValueBadge = document.getElementById('delayValueBadge');

  const skipSponsoredToggle = document.getElementById('skipSponsoredToggle');
  const pauseCommentsToggle = document.getElementById('pauseCommentsToggle');
  const autoUnmuteToggle = document.getElementById('autoUnmuteToggle');
  const soundCueToggle = document.getElementById('soundCueToggle');

  const connectionDot = document.getElementById('connectionDot');
  const connectionStatus = document.getElementById('connectionStatus');

  const DEFAULT_SETTINGS = {
    enabled: true,
    scrollDelay: 1.0,
    skipSponsored: true,
    pauseOnComments: true,
    soundNotification: false,
    autoUnmute: true
  };

  // Load saved settings
  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);

  // Update Master Switch UI
  function updateMasterUI(enabled) {
    masterToggle.checked = enabled;
    if (enabled) {
      masterCard.classList.add('active');
      masterStatus.textContent = 'Auto-Scroll Active';
      headerPulse.style.background = '#10b981';
      headerPulse.style.boxShadow = '0 0 8px #10b981';
    } else {
      masterCard.classList.remove('active');
      masterStatus.textContent = 'Auto-Scroll Paused';
      headerPulse.style.background = '#64748b';
      headerPulse.style.boxShadow = 'none';
    }
  }

  // Populate controls
  updateMasterUI(settings.enabled);
  delayRange.value = settings.scrollDelay;
  delayValueBadge.textContent = `${parseFloat(settings.scrollDelay).toFixed(1)}s`;
  skipSponsoredToggle.checked = settings.skipSponsored;
  pauseCommentsToggle.checked = settings.pauseOnComments;
  autoUnmuteToggle.checked = settings.autoUnmute !== undefined ? settings.autoUnmute : true;
  soundCueToggle.checked = settings.soundNotification;

  // Broadcast settings to active tab
  async function broadcastSettings(newSettings) {
    await chrome.storage.local.set(newSettings);

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].url && tabs[0].url.includes('facebook.com')) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'STATE_CHANGED',
        settings: newSettings
      }).catch(() => {});
    }

    if (newSettings.enabled !== undefined) {
      chrome.runtime.sendMessage({
        action: 'UPDATE_BADGE',
        enabled: newSettings.enabled
      }).catch(() => {});
    }
  }

  // Master Toggle Change
  masterToggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    updateMasterUI(enabled);
    broadcastSettings({ enabled });
  });

  // Delay Slider Input & Change
  delayRange.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value).toFixed(1);
    delayValueBadge.textContent = `${val}s`;
  });

  delayRange.addEventListener('change', (e) => {
    const scrollDelay = parseFloat(e.target.value);
    broadcastSettings({ scrollDelay });
  });

  // Skip Sponsored Toggle
  skipSponsoredToggle.addEventListener('change', (e) => {
    broadcastSettings({ skipSponsored: e.target.checked });
  });

  // Pause on Comments Toggle
  pauseCommentsToggle.addEventListener('change', (e) => {
    broadcastSettings({ pauseOnComments: e.target.checked });
  });

  // Auto Unmute Toggle
  autoUnmuteToggle.addEventListener('change', (e) => {
    broadcastSettings({ autoUnmute: e.target.checked });
  });

  // Sound Cue Toggle
  soundCueToggle.addEventListener('change', (e) => {
    broadcastSettings({ soundNotification: e.target.checked });
  });

  // Check current tab status
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.url && activeTab.url.includes('facebook.com')) {
      if (activeTab.url.includes('/reel/') || activeTab.url.includes('/watch/reels')) {
        connectionStatus.textContent = 'Watching Facebook Reels';
      } else {
        connectionStatus.textContent = 'Active on Facebook';
      }
      connectionDot.className = 'dot-online';
    } else {
      connectionStatus.textContent = 'Open Facebook to activate';
      connectionDot.className = 'dot-online dot-offline';
    }
  } catch (e) {
    // Ignore permissions failure if tab query is blocked
  }
});
