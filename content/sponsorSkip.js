/**
 * Facebook Reels Auto-Scroll - Sponsored Reel Detector
 * Precisely identifies sponsored reels to prevent false-positive skips.
 */

(function () {
  const EXACT_SPONSORED_TERMS = new Set([
    "sponsored",
    "bersponsor",
    "gesponsert",
    "sponsorisé",
    "sponsorizado",
    "publicidad",
    "patrocinado",
    "paid partnership",
    "kemitraan berbayar"
  ]);

  let lastSkippedTimestamp = 0;

  // Check if an immediate reel card contains verified sponsored markers
  function isSponsoredReel(reelContainer) {
    if (!reelContainer) return false;

    // Prevent false positives on high-level wrappers or page body
    if (
      reelContainer === document.body ||
      reelContainer.getAttribute('role') === 'main' ||
      reelContainer.offsetWidth > 900
    ) {
      return false;
    }

    // Cooldown check (prevent rapid skips)
    const now = Date.now();
    if (now - lastSkippedTimestamp < 3000) {
      return false;
    }

    // 1. Check for specific ad disclosure links
    const adLinks = reelContainer.querySelectorAll('a[href*="/ads/about"], a[href*="/ad_preferences"]');
    if (adLinks.length > 0) {
      lastSkippedTimestamp = now;
      return true;
    }

    // 2. Check leaf text elements inside the reel header/overlay
    const textNodes = reelContainer.querySelectorAll('span, div[role="button"]');
    for (const el of textNodes) {
      // Must be a leaf node (no nested tags) to avoid matching large paragraphs
      if (el.children.length === 0) {
        const text = (el.innerText || el.textContent || '').trim().toLowerCase();
        if (EXACT_SPONSORED_TERMS.has(text)) {
          lastSkippedTimestamp = now;
          return true;
        }
      }
    }

    return false;
  }

  window.FBSponsorWatcher = {
    isSponsoredReel
  };
})();
