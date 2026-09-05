/**
 * Facebook Reels Auto-Scroll - Scroller Engine
 * Dispatches navigation commands with multiple resilient fallbacks and debounce locks.
 */

(function () {
  let isScrolling = false;
  let lastScrollTimestamp = 0;
  const SCROLL_COOLDOWN_MS = 1400; // Minimum interval between scrolls

  // Synthesize a subtle, pleasant audio blip when transition occurs (if enabled)
  function playTransitionSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }

  // Find clickable Next Button in Facebook Reels DOM
  function findNextButton() {
    // Selectors for Facebook's next button across language variations
    const selectors = [
      'div[role="button"][aria-label*="Next" i]',
      'div[role="button"][aria-label*="Berikutnya" i]',
      'div[role="button"][aria-label*="Selanjutnya" i]',
      'div[role="button"][aria-label*="Suivant" i]',
      'div[role="button"][aria-label*="Siguiente" i]',
      'div[aria-label="Next Card" i]',
      'div[aria-label="Next Reel" i]',
      'div[aria-label="Next video" i]'
    ];

    for (const selector of selectors) {
      const btn = document.querySelector(selector);
      if (btn && btn.offsetParent !== null) {
        return btn;
      }
    }

    // Secondary search: Find navigation buttons located on the right or bottom of reels
    const buttons = document.querySelectorAll('div[role="button"]');
    for (const btn of buttons) {
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (aria.includes('next') || aria.includes('berikutnya') || aria.includes('down')) {
        return btn;
      }
    }

    return null;
  }

  // Attempt container scroll
  function scrollContainerFallback() {
    // Find the scrollable container housing the reels
    const main = document.querySelector('div[role="main"]') || document.body;
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    if (main && main !== document.body) {
      main.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
    }
  }

  // Core navigation function
  function scrollNext(options = {}) {
    const now = Date.now();
    if (isScrolling || (now - lastScrollTimestamp < SCROLL_COOLDOWN_MS)) {
      return false;
    }

    isScrolling = true;
    lastScrollTimestamp = now;

    if (options.playSound) {
      playTransitionSound();
    }

    // 1. Primary Method: Dispatch native keyboard ArrowDown events
    // This is Facebook's native desktop keyboard navigation for Reels
    const keyEventInit = {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true,
      composed: true
    };

    const targetElement = document.activeElement || document.querySelector('div[role="main"]') || document.body;
    
    // Dispatch to target element, document and window
    targetElement.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
    document.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
    window.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));

    targetElement.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));
    document.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));
    window.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));

    // 2. Secondary Method: Try finding and clicking the Next button
    setTimeout(() => {
      const nextBtn = findNextButton();
      if (nextBtn) {
        nextBtn.click();
      }
    }, 80);

    // 3. Fallback: Scroll window or container if position hasn't changed
    setTimeout(() => {
      scrollContainerFallback();
    }, 250);

    // Release scrolling lock after cooldown
    setTimeout(() => {
      isScrolling = false;
    }, SCROLL_COOLDOWN_MS);

    return true;
  }

  // Check if currently locked
  function isLocked() {
    return isScrolling || (Date.now() - lastScrollTimestamp < SCROLL_COOLDOWN_MS);
  }

  window.FBAutoScroller = {
    scrollNext,
    isLocked,
    playTransitionSound
  };
})();
