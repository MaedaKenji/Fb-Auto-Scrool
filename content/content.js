/**
 * Facebook Reels Auto-Scroll - Main Content Script Coordinator
 * Coordinates video detection, user settings, audio management, HUD updates, and scroll execution.
 */

(function () {
  let settings = {
    enabled: true,
    scrollDelay: 1.0,
    skipSponsored: true,
    pauseOnComments: true,
    soundNotification: false,
    autoUnmute: true
  };

  let isCurrentReelPinned = false;
  let initialized = false;

  // Check if current URL is a Facebook Reels or Watch page
  function isReelsPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('/reel/') || path.includes('/watch/reels') || path.includes('/reels/');
  }

  // Load configuration from extension storage
  async function loadSettings() {
    try {
      const data = await chrome.storage.local.get(settings);
      settings = { ...settings, ...data };
      if (window.FBAudioManager) {
        window.FBAudioManager.setAutoUnmute(settings.autoUnmute);
      }
    } catch (e) {
      console.warn('[FB-AutoScroll] Failed to load settings from storage:', e);
    }
  }

  // Handle video completion
  function handleVideoEnded(info) {
    if (!settings.enabled) {
      return;
    }

    if (isCurrentReelPinned) {
      window.FBAutoScrollHUD.showToast('Reel pinned: Looping current video', 1500);
      return;
    }

    // Protection: User is typing a comment or comments pane is open
    if (settings.pauseOnComments) {
      if (window.FBVideoDetector.isUserTyping() || window.FBVideoDetector.isCommentsOpen()) {
        window.FBAutoScrollHUD.updateStatus(true, false, 'PAUSED');
        return;
      }
    }

    const delayMs = Math.round((settings.scrollDelay || 1.0) * 500);

    // Show countdown on HUD
    window.FBAutoScrollHUD.showCountdown(delayMs, () => {
      // Re-verify conditions before dispatching scroll
      if (!settings.enabled || isCurrentReelPinned) return;
      if (settings.pauseOnComments && (window.FBVideoDetector.isUserTyping() || window.FBVideoDetector.isCommentsOpen())) {
        return;
      }

      window.FBAutoScroller.scrollNext({
        playSound: settings.soundNotification,
        isManual: false
      });
    });
  }

  // Handle when video target changes (user scrolled to new reel)
  function handleVideoChange(info) {
    // Reset pinned status for new reel
    isCurrentReelPinned = false;
    window.FBAutoScrollHUD.cancelCountdown();
    window.FBAutoScrollHUD.updateStatus(settings.enabled, isCurrentReelPinned);

    // Auto-unmute sound if enabled
    if (settings.autoUnmute && window.FBAudioManager) {
      setTimeout(() => {
        window.FBAudioManager.unmuteCurrentVideo(info.video);
      }, 150);
    }

    // Check if new reel is sponsored/ad with debounce
    if (settings.enabled && settings.skipSponsored) {
      setTimeout(() => {
        if (!settings.enabled || window.FBAutoScroller.isLocked()) return;
        const container = window.FBVideoDetector.getActiveContainer();
        if (container && window.FBSponsorWatcher.isSponsoredReel(container)) {
          window.FBAutoScrollHUD.showToast('Skipping Sponsored Reel...', 1000);
          window.FBAutoScroller.scrollNext({ playSound: false, isManual: false });
        }
      }, 800);
    }
  }

  // Toggle master enabled state
  async function toggleAutoScroll() {
    settings.enabled = !settings.enabled;
    await chrome.storage.local.set({ enabled: settings.enabled });

    window.FBAutoScrollHUD.cancelCountdown();
    window.FBAutoScrollHUD.updateStatus(settings.enabled, isCurrentReelPinned);

    const message = settings.enabled ? 'Auto-Scroll Enabled' : 'Auto-Scroll Disabled';
    window.FBAutoScrollHUD.showToast(message);

    chrome.runtime.sendMessage({
      action: 'UPDATE_BADGE',
      enabled: settings.enabled
    }).catch(() => {});
  }

  // Toggle pinned loop for current reel
  function toggleLoopCurrentReel() {
    isCurrentReelPinned = !isCurrentReelPinned;
    window.FBAutoScrollHUD.cancelCountdown();
    window.FBAutoScrollHUD.updateStatus(settings.enabled, isCurrentReelPinned);

    const message = isCurrentReelPinned ? 'Pinned: Looping this reel' : 'Unpinned: Auto-scroll resumed';
    window.FBAutoScrollHUD.showToast(message);
  }

  // Listen for keyboard shortcuts (Shift+D)
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (window.FBVideoDetector.isUserTyping()) {
        return;
      }

      // Shortcut: Shift + D
      if (e.shiftKey && (e.key === 'D' || e.key === 'd') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleAutoScroll();
      }

      // Shortcut: Shift + L to pin/loop current reel
      if (e.shiftKey && (e.key === 'L' || e.key === 'l') && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleLoopCurrentReel();
      }
    }, true);
  }

  // Listen for messages from popup or background worker
  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'STATE_CHANGED' && message.settings) {
        settings = { ...settings, ...message.settings };
        if (window.FBAudioManager && message.settings.autoUnmute !== undefined) {
          window.FBAudioManager.setAutoUnmute(message.settings.autoUnmute);
        }
        window.FBAutoScrollHUD.cancelCountdown();
        window.FBAutoScrollHUD.updateStatus(settings.enabled, isCurrentReelPinned);
        sendResponse({ success: true });
      } else if (message.action === 'PING') {
        sendResponse({ isReels: isReelsPage(), enabled: settings.enabled });
      }
      return true;
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        for (const [key, change] of Object.entries(changes)) {
          settings[key] = change.newValue;
          if (key === 'autoUnmute' && window.FBAudioManager) {
            window.FBAudioManager.setAutoUnmute(change.newValue);
          }
        }
        window.FBAutoScrollHUD.updateStatus(settings.enabled, isCurrentReelPinned);
      }
    });
  }

  // Main initialization sequence
  async function init() {
    if (initialized) return;
    initialized = true;

    await loadSettings();

    // Initialize HUD overlay
    window.FBAutoScrollHUD.init(toggleAutoScroll, toggleLoopCurrentReel);
    window.FBAutoScrollHUD.updateStatus(settings.enabled, isCurrentReelPinned);

    // Setup shortcuts and communications
    setupKeyboardShortcuts();
    setupMessageListeners();

    // Start video detection engine
    window.FBVideoDetector.start(handleVideoEnded, handleVideoChange);

    console.log('[FB-AutoScroll] Extension initialized successfully.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Monitor SPA URL changes
  let currentUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      // Auto-unmute on SPA route change
      if (settings.autoUnmute && window.FBAudioManager) {
        setTimeout(() => {
          window.FBAudioManager.unmuteCurrentVideo();
        }, 200);
      }
    }
  }, 500);
})();
