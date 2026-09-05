/**
 * Facebook Reels Auto-Scroll - Sponsored Reel Detector
 * Detects and auto-skips sponsored reels and ads.
 */

(function () {
  const SPONSORED_KEYWORDS = [
    "sponsored",
    "bersponsor",
    "gesponsert",
    "sponsorisé",
    "sponsorizado",
    "publicidad",
    "patrocinado",
    "paid partnership",
    "kemitraan berbayar"
  ];

  // Check if a reel card or element contains sponsored markers
  function isSponsoredReel(reelContainer) {
    if (!reelContainer) return false;

    // 1. Check for ad-specific links or attributes
    const adLinks = reelContainer.querySelectorAll('a[href*="/ads/about"], a[href*="/ad_preferences"], [aria-label*="Sponsored" i], [aria-label*="Bersponsor" i]');
    if (adLinks.length > 0) return true;

    // 2. Check inner text of headers or labels in container
    const headerElements = reelContainer.querySelectorAll('span, div, p');
    for (const el of headerElements) {
      // Only check short label nodes to avoid false positives in long captions
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (text && text.length < 30) {
        if (SPONSORED_KEYWORDS.includes(text)) {
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
