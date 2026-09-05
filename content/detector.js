/**
 * Facebook Reels Auto-Scroll - Video Player & End-of-Reel Detector
 * Monitors DOM mutations, tracks active reel video, detects video completion and loops.
 */

(function () {
  let activeVideo = null;
  let activeReelContainer = null;
  let lastTime = 0;
  let completionFired = false;
  let lastCompletionTimestamp = 0;
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
    // Facebook comments drawer on Reels typically has role="dialog" or specific comment list
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

    // Center coordinates of the video
    const centerY = rect.top + rect.height / 2;
    const centerX = rect.left + rect.width / 2;

    const inY = centerY >= winHeight * 0.15 && centerY <= winHeight * 0.85;
    const inX = centerX >= 0 && centerX <= winWidth;
    const hasSize = rect.width >= 150 && rect.height >= 200;

    return inY && inX && hasSize;
  }

  // Locate the reel card/container surrounding the video
  function findReelContainer(video) {
    let current = video.parentElement;
    while (current && current !== document.body) {
      // Look for Facebook's feed card container boundaries
      if (
        current.getAttribute('role') === 'main' ||
        current.getAttribute('data-pagelet') ||
        (current.offsetHeight > window.innerHeight * 0.6 && current.offsetWidth > 250)
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

    // 1. First priority: Video in viewport that is playing
    for (const video of videos) {
      if (!video.paused && !video.ended && isVideoInViewport(video)) {
        return video;
      }
    }

    // 2. Second priority: Any video in viewport
    for (const video of videos) {
      if (isVideoInViewport(video)) {
        return video;
      }
    }

    // 3. Fallback: First video with valid duration
    return videos.find(v => v.duration > 0) || videos[0] || null;
  }

  // Trigger completion safely with debouncing
  function triggerCompletion(reason, isAd = false) {
    const now = Date.now();
    if (completionFired || (now - lastCompletionTimestamp < 1500)) {
      return;
    }

    completionFired = true;
    lastCompletionTimestamp = now;

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

    // Remove loop attribute so standard ended event can fire natively if allowed
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

      // Check remaining playback time (threshold: 0.35s)
      if (duration > 1 && (duration - currentTime <= 0.35)) {
        triggerCompletion('time_threshold');
        return;
      }

      // Loop wrap-around detection (video suddenly restarted from end to start)
      if (lastTime > (duration - 1.2) && currentTime < 0.5) {
        triggerCompletion('loop_restart');
      }

      lastTime = currentTime;
    };

    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);

    // Save cleanup references on the video element
    video._fbAsCleanup = () => {
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
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
      completionFired = false;

      attachVideoListeners(activeVideo);

      if (typeof callbacks.onVideoChange === 'function') {
        callbacks.onVideoChange({
          video: activeVideo,
          container: activeReelContainer
        });
      }
    } else if (activeVideo) {
      // If same video restarted from 0 after completion fired, reset flag
      if (completionFired && activeVideo.currentTime < 1.0 && (Date.now() - lastCompletionTimestamp > 2500)) {
        completionFired = false;
      }
    }
  }

  function start(onEnded, onVideoChange) {
    callbacks.onVideoEnded = onEnded;
    callbacks.onVideoChange = onVideoChange;

    // Initial check
    checkCurrentVideo();

    // High frequency interval to keep up with fast user scrolling and dynamic DOM
    if (!pollInterval) {
      pollInterval = setInterval(checkCurrentVideo, 300);
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

  function resetCompletionFlag() {
    completionFired = false;
  }

  window.FBVideoDetector = {
    start,
    stop,
    getActiveVideo: () => activeVideo,
    getActiveContainer: () => activeReelContainer,
    isUserTyping,
    isCommentsOpen,
    resetCompletionFlag,
    triggerCompletion
  };
})();
