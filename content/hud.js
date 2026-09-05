/**
 * Facebook Reels Auto-Scroll - Floating HUD and Notifications
 * Renders the modern floating pill indicator and toast messages.
 */

(function () {
  let hudContainer = null;
  let statusDot = null;
  let stateBadge = null;
  let labelText = null;
  let progressBar = null;
  let loopBtn = null;
  let countdownTimer = null;
  let countdownStartTime = 0;
  let countdownTotalMs = 0;
  let toastContainer = null;

  // Icons
  const REPEAT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
  const DOWN_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;

  function init(onToggle, onLoopToggle) {
    if (document.getElementById('fb-autoscroll-hud-root')) {
      return;
    }

    // Root wrapper
    hudContainer = document.createElement('div');
    hudContainer.id = 'fb-autoscroll-hud-root';

    // Main pill
    const pill = document.createElement('div');
    pill.className = 'fb-as-pill';
    pill.title = 'Facebook Reels Auto-Scroll (Click to Toggle, Shortcut: Shift+D)';

    // Status dot
    statusDot = document.createElement('div');
    statusDot.className = 'fb-as-status-dot';

    // Label & text
    const label = document.createElement('div');
    label.className = 'fb-as-label';

    labelText = document.createElement('span');
    labelText.textContent = 'Auto-Scroll';

    stateBadge = document.createElement('span');
    stateBadge.className = 'fb-as-state-badge';
    stateBadge.textContent = 'OFF';

    label.appendChild(labelText);
    label.appendChild(stateBadge);

    // Button group
    const btnGroup = document.createElement('div');
    btnGroup.className = 'fb-as-btn-group';

    // Loop button
    loopBtn = document.createElement('button');
    loopBtn.className = 'fb-as-icon-btn';
    loopBtn.title = 'Loop this reel (Pause auto-scroll for this video)';
    loopBtn.innerHTML = REPEAT_ICON;
    loopBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof onLoopToggle === 'function') {
        onLoopToggle();
      }
    });

    // Manual Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'fb-as-icon-btn';
    nextBtn.title = 'Scroll to next reel now';
    nextBtn.innerHTML = DOWN_ICON;
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.FBAutoScroller) {
        window.FBAutoScroller.scrollNext();
      }
    });

    btnGroup.appendChild(loopBtn);
    btnGroup.appendChild(nextBtn);

    // Progress bar for scroll countdown
    progressBar = document.createElement('div');
    progressBar.className = 'fb-as-progress-bar';

    // Assemble pill
    pill.appendChild(statusDot);
    pill.appendChild(label);
    pill.appendChild(btnGroup);
    pill.appendChild(progressBar);

    // Pill click toggles master auto-scroll
    pill.addEventListener('click', (e) => {
      if (e.target.closest('.fb-as-btn-group')) return;
      if (typeof onToggle === 'function') {
        onToggle();
      }
    });

    hudContainer.appendChild(pill);
    document.body.appendChild(hudContainer);

    // Toast container
    toastContainer = document.createElement('div');
    toastContainer.className = 'fb-as-toast-container';
    document.body.appendChild(toastContainer);
  }

  function updateStatus(enabled, isPinned = false, extraText = '') {
    if (!statusDot) return;

    if (enabled) {
      statusDot.classList.add('active');
      stateBadge.classList.add('active');
      stateBadge.textContent = isPinned ? 'PINNED' : (extraText || 'ON');
    } else {
      statusDot.classList.remove('active');
      stateBadge.classList.remove('active');
      stateBadge.textContent = extraText || 'OFF';
    }

    if (loopBtn) {
      if (isPinned) {
        loopBtn.classList.add('pinned');
        loopBtn.title = 'Pinned (Looping this reel). Click to unpin.';
      } else {
        loopBtn.classList.remove('pinned');
        loopBtn.title = 'Loop this reel (Pause auto-scroll for this video)';
      }
    }
  }

  function showCountdown(delayMs, onComplete) {
    cancelCountdown();
    if (delayMs <= 0) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    countdownTotalMs = delayMs;
    countdownStartTime = Date.now();

    const interval = 25;
    countdownTimer = setInterval(() => {
      const elapsed = Date.now() - countdownStartTime;
      const progress = Math.min(100, (elapsed / countdownTotalMs) * 100);
      const remainingSec = Math.max(0, ((countdownTotalMs - elapsed) / 1000)).toFixed(1);

      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      if (stateBadge) {
        stateBadge.textContent = `${remainingSec}s`;
      }

      if (elapsed >= countdownTotalMs) {
        cancelCountdown();
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }
    }, interval);
  }

  function cancelCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (progressBar) {
      progressBar.style.width = '0%';
    }
  }

  function showToast(message, duration = 2200) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'fb-as-toast';
    toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 250);
    }, duration);
  }

  window.FBAutoScrollHUD = {
    init,
    updateStatus,
    showCountdown,
    cancelCountdown,
    showToast
  };
})();
