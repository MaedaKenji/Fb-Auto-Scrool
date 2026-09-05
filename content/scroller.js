/**
 * Facebook Reels Auto-Scroll - Scroller Engine
 * Dispatches navigation commands with single-action execution, safe cooldowns,
 * and zero double-scrolling.
 */

(function () {
  let isScrolling = false;
  let lastScrollTimestamp = 0;
  const MANUAL_COOLDOWN_MS = 320; // Snappy for user clicks
  const AUTO_COOLDOWN_MS = 1000;  // Safe cooldown to allow full Facebook slide animation (600-800ms)

  // Synthesize a subtle audio blip when transition occurs (if enabled)
  function playTransitionSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  }

  // Find clickable Next Button in Facebook Reels DOM
  function findNextButton() {
    // Strategy 1: Search by known aria-labels (case-insensitive substring)
    const candidates = Array.from(document.querySelectorAll('div[role="button"], button, [aria-label]'));

    const nextKeywords = [
      'next card', 'next reel', 'next video', 'next',
      'kartu berikutnya', 'video berikutnya', 'berikutnya', 'selanjutnya',
      'ke bawah', 'gulir ke bawah', 'down', 'suivant', 'siguiente'
    ];

    for (const el of candidates) {
      if (el.offsetParent === null) continue;
      const label = (el.getAttribute('aria-label') || '').toLowerCase().trim();
      if (!label) continue;
      for (const kw of nextKeywords) {
        if (label.includes(kw)) {
          return el;
        }
      }
    }

    // Strategy 2: Position-based detection of circular next-reel navigation button
    // On desktop Facebook Reels, Previous (^) and Next (v) are circular buttons on the right side
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;
    const rightSideButtons = [];

    for (const el of candidates) {
      if (el.offsetParent === null) continue;
      const rect = el.getBoundingClientRect();
      if (
        rect.left >= winWidth * 0.55 &&
        rect.width >= 24 && rect.width <= 100 &&
        rect.height >= 24 && rect.height <= 100 &&
        rect.top >= winHeight * 0.15 && rect.bottom <= winHeight * 0.95
      ) {
        if (el.querySelector('svg')) {
          rightSideButtons.push({ el, top: rect.top });
        }
      }
    }

    if (rightSideButtons.length >= 2) {
      rightSideButtons.sort((a, b) => a.top - b.top);
      return rightSideButtons[rightSideButtons.length - 1].el;
    } else if (rightSideButtons.length === 1) {
      return rightSideButtons[0].el;
    }

    return null;
  }

  // Dispatch EXACTLY ONE synthetic ArrowDown keyboard event
  function dispatchArrowDown() {
    const keyEventInit = {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true,
      composed: true
    };

    // If activeElement is inside our HUD, blur it so keyboard event targets Facebook
    if (document.activeElement && document.activeElement.closest && document.activeElement.closest('#fb-autoscroll-hud-root')) {
      try { document.activeElement.blur(); } catch (e) {}
    }

    // Prefer dispatching from the active video so the event bubbles up through
    // the reel container, React root, and document
    const activeVideo = window.FBVideoDetector ? window.FBVideoDetector.getActiveVideo() : null;
    let target = (activeVideo && activeVideo.isConnected) ? activeVideo : null;

    if (!target) {
      target = (document.activeElement && document.activeElement !== document.body)
        ? document.activeElement
        : (document.body || document.documentElement || document);
    }

    try {
      target.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
      target.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));
    } catch (e) {
      try {
        (document.body || document).dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
        (document.body || document).dispatchEvent(new KeyboardEvent('keyup', keyEventInit));
      } catch (err) {}
    }
  }

  // Scroll container fallback
  function scrollContainerFallback() {
    const video = window.FBVideoDetector ? window.FBVideoDetector.getActiveVideo() : document.querySelector('video');
    let current = video ? video.parentElement : null;

    while (current && current !== document.body && current !== document.documentElement) {
      const overflowY = window.getComputedStyle(current).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
        current.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
        return true;
      }
      current = current.parentElement;
    }

    window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
    return true;
  }

  // Core navigation function: Single action, safe cooldown, no premature fallbacks
  function scrollNext(options = {}) {
    const isManual = Boolean(options.isManual);
    const cooldown = isManual ? MANUAL_COOLDOWN_MS : AUTO_COOLDOWN_MS;
    const now = Date.now();

    if (isScrolling || (now - lastScrollTimestamp < cooldown)) {
      return false;
    }

    isScrolling = true;
    lastScrollTimestamp = now;

    if (options.playSound) {
      playTransitionSound();
    }

    const initialUrl = window.location.href;

    // STEP 1: PRIMARY ACTION - Dispatch ArrowDown immediately (0ms).
    // ArrowDown is Facebook's native keyboard navigation for Reels.
    dispatchArrowDown();

    // STEP 2: Fallback after 750ms IF AND ONLY IF URL has not changed
    setTimeout(() => {
      if (window.location.href === initialUrl) {
        scrollContainerFallback();
      }
    }, 750);

    // STEP 3: Unlock after 1000ms (safe cooldown past FB's 600-800ms slide animation)
    setTimeout(() => {
      isScrolling = false;
      if (window.location.href === initialUrl) {
        if (window.FBVideoDetector && window.FBVideoDetector.unlockCompletion) {
          window.FBVideoDetector.unlockCompletion();
        }
        if (window.FBAutoScrollHUD && window.FBAutoScrollHUD.updateStatus) {
          window.FBAutoScrollHUD.updateStatus(true);
        }
      }
    }, 1000);

    return true;
  }

  function isLocked() {
    return isScrolling || (Date.now() - lastScrollTimestamp < AUTO_COOLDOWN_MS);
  }

  function resetLock() {
    isScrolling = false;
  }

  window.FBAutoScroller = {
    scrollNext,
    isLocked,
    resetLock,
    playTransitionSound,
    findNextButton
  };
})();
