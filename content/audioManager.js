/**
 * Facebook Reels Auto-Scroll - Audio Manager
 * Automatically unmutes videos on page load, refresh, and reel transitions.
 */

(function () {
  let autoUnmuteEnabled = true;

  const UNMUTE_SELECTORS = [
    'div[role="button"][aria-label*="Audio is muted" i]',
    'div[role="button"][aria-label*="dibisukan" i]',
    'div[role="button"][aria-label*="unmute" i]',
    'div[role="button"][aria-label*="buka suara" i]',
    'div[role="button"][aria-label*="nyalakan suara" i]',
    'div[role="button"][aria-label*="turn on sound" i]',
    'div[aria-label*="Audio is muted" i]',
    'div[aria-label*="dibisukan" i]',
    'div[aria-label*="unmute" i]',
    'div[aria-label*="buka suara" i]',
    'button[aria-label*="Audio is muted" i]',
    'button[aria-label*="unmute" i]'
  ];

  const MUTE_SELECTORS = [
    'div[role="button"][aria-label*="Audio is unmuted" i]',
    'div[role="button"][aria-label*="disuarakan" i]',
    'div[role="button"][aria-label*="mute" i]',
    'div[role="button"][aria-label*="matikan suara" i]',
    'div[aria-label*="Audio is unmuted" i]',
    'div[aria-label*="disuarakan" i]',
    'button[aria-label*="Audio is unmuted" i]'
  ];

  // Sync HUD sound icon state
  function syncHUDState(muted) {
    if (window.FBAutoScrollHUD && window.FBAutoScrollHUD.updateAudioState) {
      window.FBAutoScrollHUD.updateAudioState(muted);
    }
  }

  function getActiveVideo() {
    return (window.FBVideoDetector ? window.FBVideoDetector.getActiveVideo() : null) || document.querySelector('video');
  }

  function isMuted() {
    const video = getActiveVideo();
    if (!video) return false;
    return video.muted || video.volume === 0;
  }

  // Attempt to unmute active video
  function unmuteCurrentVideo(targetVideo) {
    if (!autoUnmuteEnabled) return;

    const video = targetVideo || getActiveVideo();
    if (!video) return;

    // 1. Click Facebook native Unmute button
    for (const sel of UNMUTE_SELECTORS) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        break;
      }
    }

    // 2. Direct HTML5 video unmute
    const wasPlaying = !video.paused;
    try {
      if (video.muted) {
        video.muted = false;
      }
      if (video.volume === 0) {
        video.volume = 1.0;
      }
    } catch (e) {}

    // 3. Fallback: Simulate 'm' keypress if still muted
    if (video.muted || video.volume === 0) {
      const keyInit = { key: 'm', code: 'KeyM', keyCode: 77, which: 77, bubbles: true };
      window.dispatchEvent(new KeyboardEvent('keydown', keyInit));
      window.dispatchEvent(new KeyboardEvent('keyup', keyInit));
    }

    // 4. Recovery: Ensure playback continues if browser reacted to unmute
    if (wasPlaying && video.paused) {
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }

    syncHUDState(video.muted);
  }

  // Toggle Mute / Unmute manually from dedicated HUD audio button
  function toggleAudio() {
    const video = getActiveVideo();
    if (!video) return;

    if (video.muted || video.volume === 0) {
      // Currently muted -> UNMUTE
      unmuteCurrentVideo(video);
    } else {
      // Currently unmuted -> MUTE
      for (const sel of MUTE_SELECTORS) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) {
          btn.click();
          break;
        }
      }
      try {
        video.muted = true;
      } catch (e) {}
      syncHUDState(true);
    }
  }

  // Attach volumechange listener to video to keep HUD in sync
  function attachVideoAudioListener(video) {
    if (!video || video._fbAudioBound) return;
    video._fbAudioBound = true;

    video.addEventListener('volumechange', () => {
      syncHUDState(video.muted || video.volume === 0);
    });

    video.addEventListener('playing', () => {
      if (autoUnmuteEnabled && (video.muted || video.volume === 0)) {
        unmuteCurrentVideo(video);
      }
      syncHUDState(video.muted || video.volume === 0);
    });
  }

  function setupInteractionListeners() {
    const gestureEvents = ['pointerdown', 'mousedown', 'keydown', 'touchstart'];
    const onGesture = () => {
      if (autoUnmuteEnabled) {
        unmuteCurrentVideo();
      }
    };

    gestureEvents.forEach(evt => {
      window.addEventListener(evt, onGesture, { capture: true, passive: true });
    });
  }

  function setAutoUnmute(enabled) {
    autoUnmuteEnabled = Boolean(enabled);
    if (autoUnmuteEnabled) {
      unmuteCurrentVideo();
    }
  }

  // Initial auto-unmute sequence on page load / refresh
  function initAutoUnmute() {
    setupInteractionListeners();

    // Staggered attempts to catch React component mounting
    [150, 400, 800, 1500, 2500, 4000].forEach((delay) => {
      setTimeout(() => {
        const video = getActiveVideo();
        if (video) {
          attachVideoAudioListener(video);
        }
        if (autoUnmuteEnabled) {
          unmuteCurrentVideo(video);
        }
      }, delay);
    });
  }

  initAutoUnmute();

  window.FBAudioManager = {
    unmuteCurrentVideo,
    toggleAudio,
    isMuted,
    setAutoUnmute,
    attachVideoAudioListener
  };
})();
