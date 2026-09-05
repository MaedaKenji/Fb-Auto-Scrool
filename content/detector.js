/**
 * Facebook Reels Auto-Scroll - Video Player & End-of-Reel Detector
 * Monitors DOM mutations, tracks active reel video, and ensures strictly ONE completion trigger per reel.
 */

(function () {
  let activeVideo = null;
  let activeReelContainer = null;
  let lastTime = 0;
  let completionFired = false;
  let lastCompletionTimestamp = 0;
  let lastCompletedUrl = '';
  let pollInterval = null;

  let callbacks = {
    onVideoEnded: null,
    onVideoChange: null
  };

  // Check if user is actively typing or editing text
  function isUserTyping() {
    const active = document.activeElement;
    if (!active) return false;
    const tagName = active.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') return true;
    if (active.isContentEditable || active.getAttribute('contenteditable') === 'true') return true;
    if (active.getAttribute('role') === 'textbox') return true;
    return false;
  }

  // Check if Facebook comments panel is currently open
  function isCommentsOpen() {
    const commentInput = document.querySelector('form div[role="textbox"], form textarea[placeholder*="comment" i], form textarea[placeholder*="komentar" i]');
    if (commentInput && commentInput.offsetParent !== null) {
      return true;
    }
    const dialogs = document.querySelectorAll('div[role="dialog"]');
    for (const dialog of dialogs) {
      const text = (dialog.innerText || '').toLowerCase();
      if (text.includes('comment') || text.includes('komentar') || text.includes('balasan')) {
        return true;
      }
    }
    return false;
  }

  // Determine if a video element is currently centered and visible in the viewport
  function isVideoInViewport(video) {
    if (!video || !video.isConnected) return false;
    const rect = video.getBoundingClientRect();
    const winHeight = window.innerHeight || document.documentElement.clientHeight;
    const winWidth = window.innerWidth || document.documentElement.clientWidth;

    const centerY = rect.top + rect.height / 2;
    const centerX = rect.left + rect.width / 2;

    const inY = centerY >= winHeight * 0.15 && centerY <= winHeight * 0.85;
    const inX = centerX >= 0 && centerX <= winWidth;
    const hasSize = rect.width >= 150 && rect.height >= 200;

    return inY && inX && hasSize;
  }

  // Locate the specific reel card surrounding the video (scoped tightly)
  function findReelContainer(video) {
    let current = video.parentElement;
    while (current && current !== document.body) {
      // Must NOT be the whole page main container
      if (current.getAttribute('role') === 'main') {
        break;
      }
      // Target the vertical reel card (bounded width and height)
      if (
        current.offsetHeight >= window.innerHeight * 0.5 &&
        current.offsetWidth <= 750 &&
        current.offsetWidth >= 200
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return video.parentElement || video;
  }

  // Find the primary active video on screen
  function findActiveVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;

    // 1. First priority: Playing video in viewport
    for (const video of videos) {
      if (!video.paused && !video.ended && isVideoInViewport(video)) {
        return video;
      }
    }

    // 2. Second priority: Any video centered in viewport
    for (const video of videos) {
      if (isVideoInViewport(video)) {
        return video;
      }
    }

    return null;
  }

  // Trigger completion strictly ONCE per video/reel
  function triggerCompletion(reason, isAd = false) {
    const now = Date.now();
    const currentUrl = window.location.href;

    // Guard: Video already marked complete
    if (!activeVideo || activeVideo._fbCompleted) {
      return;
    }

    // Guard: Already completed on this exact URL within 3 seconds
    if (lastCompletedUrl && currentUrl === lastCompletedUrl && (now - lastCompletionTimestamp < 3000)) {
      return;
    }

    // Guard: Cooldown lock
    if (completionFired || (now - lastCompletionTimestamp < 2500)) {
      return;
    }

    // Mark as completed permanently for this video instance
    activeVideo._fbCompleted = true;
    completionFired = true;
    lastCompletionTimestamp = now;
    lastCompletedUrl = currentUrl;

    if (typeof callbacks.onVideoEnded === 'function') {
      callbacks.onVideoEnded({
        video: activeVideo,
        container: activeReelContainer,
        reason,
        isAd
      });
    }
  }

  // Attach event handlers to active video
  function attachVideoListeners(video) {
    if (!video) return;

    try {
      video.loop = false;
    } catch (e) {}

    const onEnded = () => {
      triggerCompletion('ended_event');
    };

    const onTimeUpdate = () => {
      if (!video || !video.duration || !Number.isFinite(video.duration)) {
        return;
      }

      const duration = video.duration;
      const currentTime = video.currentTime;

      // Reset completed status if user rewound or video restarted from beginning
      if (currentTime < 1.0 && video._fbCompleted) {
        video._fbCompleted = false;
        completionFired = false;
      }

      if (video._fbCompleted) {
        return;
      }

      // Minimum duration to prevent instant glitch triggers
      if (duration < 1.5) return;

      // Check remaining playback time (threshold: 0.35s)
      if (duration - currentTime <= 0.35) {
        triggerCompletion('time_threshold');
        return;
      }

      // Loop wrap-around detection (restarted from near duration to beginning)
      if (lastTime > (duration - 1.0) && currentTime < 0.3) {
        video._fbCompleted = false;
        completionFired = false;
        triggerCompletion('loop_restart');
      }

      lastTime = currentTime;
    };

    const onPlay = () => {
      // If playing from beginning, ensure completion flags are clear
      if (video.currentTime < 1.5) {
        video._fbCompleted = false;
        completionFired = false;
      }
      if (window.FBAutoScrollHUD && window.FBAutoScrollHUD.setInterruptedState) {
        window.FBAutoScrollHUD.setInterruptedState(false);
      }
    };

    const onPause = () => {
      if (!video || video._fbCompleted) return;

      // Detect if pause was caused by tab switch or window blur
      const isInterrupted = !document.hasFocus() || document.hidden;
      if (isInterrupted) {
        if (window.FBAutoScrollHUD && window.FBAutoScrollHUD.setInterruptedState) {
          window.FBAutoScrollHUD.setInterruptedState(
            true,
            '👆 RESUME',
            'Auto-scroll paused because tab or window lost focus. Click anywhere on the page to resume!'
          );
        }
      }
    };

    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    video._fbAsCleanup = () => {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }

  // Scan and refresh current video target
  function checkCurrentVideo() {
    const detected = findActiveVideo();
    if (detected && detected !== activeVideo) {
      if (activeVideo && activeVideo._fbAsCleanup) {
        activeVideo._fbAsCleanup();
      }

      activeVideo = detected;
      activeReelContainer = findReelContainer(detected);
      lastTime = activeVideo.currentTime || 0;
      
      // Crucial: Always allow newly focused reel to be completed (e.g. when scrolling up or down)
      activeVideo._fbCompleted = false;
      completionFired = false;
      lastCompletedUrl = null;

      attachVideoListeners(activeVideo);

      if (typeof callbacks.onVideoChange === 'function') {
        callbacks.onVideoChange({
          video: activeVideo,
          container: activeReelContainer
        });
      }
    }
  }

  // Watch for SPA URL changes (when user scrolls up or down to another reel)
  let lastMonitoredUrl = window.location.href;

  function checkUrlChange() {
    const current = window.location.href;
    if (current !== lastMonitoredUrl) {
      lastMonitoredUrl = current;
      unlockCompletion();
      if (window.FBAutoScroller && window.FBAutoScroller.resetLock) {
        window.FBAutoScroller.resetLock();
      }
      checkCurrentVideo();
    }
  }

  // Setup listeners to detect manual scroll up actions
  function setupManualScrollListeners() {
    // Mouse wheel up (deltaY < 0)
    window.addEventListener('wheel', (e) => {
      if (e.deltaY < 0) {
        unlockCompletion();
        if (window.FBAutoScroller && window.FBAutoScroller.resetLock) {
          window.FBAutoScroller.resetLock();
        }
        setTimeout(checkCurrentVideo, 120);
      }
    }, { passive: true });

    // Keyboard ArrowUp or PageUp
    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        unlockCompletion();
        if (window.FBAutoScroller && window.FBAutoScroller.resetLock) {
          window.FBAutoScroller.resetLock();
        }
        setTimeout(checkCurrentVideo, 120);
      }
    }, { passive: true });

    // Browser navigation (back/forward or SPA history pop)
    window.addEventListener('popstate', checkUrlChange);
  }

  function start(onEnded, onVideoChange) {
    callbacks.onVideoEnded = onEnded;
    callbacks.onVideoChange = onVideoChange;

    setupManualScrollListeners();
    checkCurrentVideo();

    if (!pollInterval) {
      pollInterval = setInterval(() => {
        checkUrlChange();
        checkCurrentVideo();
      }, 250);
    }
  }

  function stop() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    if (activeVideo && activeVideo._fbAsCleanup) {
      activeVideo._fbAsCleanup();
    }
    activeVideo = null;
    activeReelContainer = null;
    completionFired = false;
  }

  function unlockCompletion() {
    completionFired = false;
    lastCompletedUrl = null;
    if (activeVideo) {
      activeVideo._fbCompleted = false;
    }
  }

  window.FBVideoDetector = {
    start,
    stop,
    refresh: checkCurrentVideo,
    getActiveVideo: () => activeVideo,
    getActiveContainer: () => activeReelContainer,
    isUserTyping,
    isCommentsOpen,
    triggerCompletion,
    unlockCompletion
  };
})();
