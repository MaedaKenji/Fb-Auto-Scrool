/**
 * Facebook Reels Auto-Scroll - Scroller Engine
 * Dispatches navigation commands with fast manual response and safe auto cooldowns.
 */

(function () {
  let isScrolling = false;
  let lastScrollTimestamp = 0;
  const MANUAL_COOLDOWN_MS = 320; // Fast and snappy for user clicks
  const AUTO_COOLDOWN_MS = 800;   // Safe cooldown for automated transitions

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
    } catch (e) {
      // Audio context might be restricted
    }
  }

  // Find clickable Next Button in Facebook Reels DOM
  function findNextButton() {
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
    return null;
  }

  // Core navigation function
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

    // 1. Primary Method: Dispatch EXACTLY ONE ArrowDown event to window
    const keyEventInit = {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true,
      composed: true
    };

    window.dispatchEvent(new KeyboardEvent('keydown', keyEventInit));
    window.dispatchEvent(new KeyboardEvent('keyup', keyEventInit));

    // 2. Fallback: If after 500ms the URL did not change, try clicking the next button
    setTimeout(() => {
      if (window.location.href === initialUrl) {
        const nextBtn = findNextButton();
        if (nextBtn) {
          nextBtn.click();
        }
      }
    }, 500);

    // Release lock quickly so subsequent clicks work smoothly
    setTimeout(() => {
      isScrolling = false;
    }, cooldown);

    return true;
  }

  function isLocked() {
    return isScrolling || (Date.now() - lastScrollTimestamp < AUTO_COOLDOWN_MS);
  }

  window.FBAutoScroller = {
    scrollNext,
    isLocked,
    playTransitionSound
  };
})();
