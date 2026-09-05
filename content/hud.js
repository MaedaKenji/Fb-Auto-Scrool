/**
 * Facebook Reels Auto-Scroll - Floating HUD and Notifications
 * Draggable pill indicator, countdown timer, and quick controls.
 */

(function () {
  let hudContainer = null;
  let pill = null;
  let statusDot = null;
  let stateBadge = null;
  let labelText = null;
  let progressBar = null;
  let loopBtn = null;
  let audioBtn = null;
  let countdownTimer = null;
  let countdownStartTime = 0;
  let countdownTotalMs = 0;
  let toastContainer = null;

  // Dragging state
  let isDragging = false;
  let hasMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let suppressClick = false;

  // Icons
  const GRIP_ICON = `<svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor"><circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/><circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/><circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/></svg>`;
  const REPEAT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
  const DOWN_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>`;
  const SPEAKER_ON_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  const SPEAKER_OFF_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

  // Restore saved HUD position
  function restorePosition() {
    try {
      const saved = localStorage.getItem('fb_autoscroll_hud_pos');
      if (saved && hudContainer) {
        const pos = JSON.parse(saved);
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        // Ensure position remains inside current viewport
        const clampedX = Math.max(10, Math.min(winWidth - 180, pos.x));
        const clampedY = Math.max(10, Math.min(winHeight - 60, pos.y));

        hudContainer.style.left = `${clampedX}px`;
        hudContainer.style.top = `${clampedY}px`;
        hudContainer.style.right = 'auto';
        hudContainer.style.bottom = 'auto';
      }
    } catch (e) {}
  }

  // Save HUD position
  function savePosition(x, y) {
    try {
      localStorage.setItem('fb_autoscroll_hud_pos', JSON.stringify({ x, y }));
    } catch (e) {}
  }

  // Setup Drag and Drop handling
  function setupDraggable(container, dragElement) {
    function onPointerDown(clientX, clientY, target) {
      // Don't drag if clicking buttons inside group
      if (target.closest('.fb-as-btn-group')) return;

      isDragging = true;
      hasMoved = false;
      dragStartX = clientX;
      dragStartY = clientY;

      const rect = container.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      container.classList.add('dragging');
      pill.classList.add('dragging');
    }

    function onPointerMove(clientX, clientY) {
      if (!isDragging) return;

      const deltaX = clientX - dragStartX;
      const deltaY = clientY - dragStartY;

      if (!hasMoved && Math.hypot(deltaX, deltaY) > 4) {
        hasMoved = true;
      }

      if (hasMoved) {
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const rect = container.getBoundingClientRect();

        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        // Constrain to viewport boundaries
        newLeft = Math.max(10, Math.min(winWidth - rect.width - 10, newLeft));
        newTop = Math.max(10, Math.min(winHeight - rect.height - 10, newTop));

        container.style.left = `${newLeft}px`;
        container.style.top = `${newTop}px`;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
      }
    }

    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      container.classList.remove('dragging');
      pill.classList.remove('dragging');

      if (hasMoved) {
        suppressClick = true;
        setTimeout(() => {
          suppressClick = false;
        }, 120);

        const rect = container.getBoundingClientRect();
        savePosition(rect.left, rect.top);
      }
    }

    // Mouse listeners
    dragElement.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      onPointerDown(e.clientX, e.clientY, e.target);

      const moveHandler = (ev) => onPointerMove(ev.clientX, ev.clientY);
      const upHandler = () => {
        onPointerUp();
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
      };

      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
    });

    // Touch listeners
    dragElement.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      onPointerDown(e.touches[0].clientX, e.touches[0].clientY, e.target);

      const moveHandler = (ev) => {
        if (ev.touches.length === 1) {
          onPointerMove(ev.touches[0].clientX, ev.touches[0].clientY);
        }
      };
      const endHandler = () => {
        onPointerUp();
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('touchend', endHandler);
      };

      document.addEventListener('touchmove', moveHandler, { passive: true });
      document.addEventListener('touchend', endHandler);
    }, { passive: true });
  }

  function init(onToggle, onLoopToggle) {
    if (document.getElementById('fb-autoscroll-hud-root')) {
      return;
    }

    // Root wrapper
    hudContainer = document.createElement('div');
    hudContainer.id = 'fb-autoscroll-hud-root';

    // Main pill
    pill = document.createElement('div');
    pill.className = 'fb-as-pill';
    pill.title = 'Facebook Reels Auto-Scroll (Drag to move, click to toggle)';

    // Drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'fb-as-drag-handle';
    dragHandle.innerHTML = GRIP_ICON;

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

    // Audio Mute/Unmute toggle button
    audioBtn = document.createElement('button');
    audioBtn.className = 'fb-as-icon-btn fb-as-audio-btn';
    audioBtn.title = 'Sound (Click to toggle)';
    audioBtn.innerHTML = SPEAKER_ON_ICON;
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.FBAudioManager) {
        window.FBAudioManager.toggleAudio();
      }
    });

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

    // Fast Responsive Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'fb-as-icon-btn';
    nextBtn.title = 'Scroll to next reel now (Fast)';
    nextBtn.innerHTML = DOWN_ICON;
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cancelCountdown();
      if (window.FBAutoScroller) {
        window.FBAutoScroller.scrollNext({ isManual: true });
      }
    });

    btnGroup.appendChild(audioBtn);
    btnGroup.appendChild(loopBtn);
    btnGroup.appendChild(nextBtn);

    // Progress bar for scroll countdown
    progressBar = document.createElement('div');
    progressBar.className = 'fb-as-progress-bar';

    // Assemble pill
    pill.appendChild(dragHandle);
    pill.appendChild(statusDot);
    pill.appendChild(label);
    pill.appendChild(btnGroup);
    pill.appendChild(progressBar);

    // Pill click: toggles master auto-scroll or resumes interrupted playback
    pill.addEventListener('click', (e) => {
      if (suppressClick || e.target.closest('.fb-as-btn-group')) return;
      if (isInterruptedState) {
        setInterruptedState(false);
        const video = window.FBVideoDetector ? window.FBVideoDetector.getActiveVideo() : null;
        if (video && video.paused) {
          video.play().catch(() => {});
        }
        updateStatus(true);
        return;
      }
      if (typeof onToggle === 'function') {
        onToggle();
      }
    });

    hudContainer.appendChild(pill);
    document.body.appendChild(hudContainer);

    // Restore previous drag position
    restorePosition();

    // Make pill draggable
    setupDraggable(hudContainer, pill);

    // Toast container
    toastContainer = document.createElement('div');
    toastContainer.className = 'fb-as-toast-container';
    document.body.appendChild(toastContainer);

    // Re-clamp position on window resize
    window.addEventListener('resize', restorePosition);
  }

  let currentStatusText = 'ON';

  function updateStatus(enabled, isPinned = false, extraText = '') {
    if (!statusDot) return;

    currentStatusText = isPinned ? 'PINNED' : (extraText || (enabled ? 'ON' : 'OFF'));

    if (enabled) {
      statusDot.classList.add('active');
      stateBadge.classList.add('active');
      stateBadge.textContent = currentStatusText;
    } else {
      statusDot.classList.remove('active');
      stateBadge.classList.remove('active');
      stateBadge.textContent = currentStatusText;
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

    if (progressBar) {
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
      void progressBar.offsetWidth; // Force synchronous layout reflow
      progressBar.style.transition = `width ${delayMs}ms linear`;
      progressBar.style.width = '100%';
    }

    countdownTimer = setTimeout(() => {
      countdownTimer = null;
      if (typeof onComplete === 'function') {
        onComplete();
      }
    }, delayMs);
  }

  function cancelCountdown() {
    if (countdownTimer) {
      clearTimeout(countdownTimer);
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (progressBar) {
      progressBar.style.transition = 'none';
      progressBar.style.width = '0%';
    }
    if (stateBadge && !isInterruptedState) {
      stateBadge.textContent = currentStatusText;
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

  function updateAudioState(isMuted) {
    if (!audioBtn) return;
    if (isMuted) {
      audioBtn.innerHTML = SPEAKER_OFF_ICON;
      audioBtn.classList.add('muted');
      audioBtn.title = 'Sound is Muted (Click to Unmute)';
    } else {
      audioBtn.innerHTML = SPEAKER_ON_ICON;
      audioBtn.classList.remove('muted');
      audioBtn.title = 'Sound is Playing (Click to Mute)';
    }
  }

  function setPendingUnmute(pending) {
    updateAudioState(pending);
  }

  let isInterruptedState = false;

  function setInterruptedState(interrupted, customLabel, customTooltip) {
    isInterruptedState = Boolean(interrupted);
    if (!statusDot || !stateBadge || !pill) return;

    if (isInterruptedState) {
      statusDot.classList.add('interrupted');
      stateBadge.classList.add('interrupted');
      stateBadge.textContent = customLabel || 'PAUSED';
      pill.title = customTooltip || 'Playback was paused by tab/app switch. Click anywhere on the page to resume.';
    } else {
      statusDot.classList.remove('interrupted');
      stateBadge.classList.remove('interrupted');
      pill.title = 'Facebook Reels Auto-Scroll (Drag to move, click to toggle)';
    }
  }

  window.FBAutoScrollHUD = {
    init,
    updateStatus,
    showCountdown,
    cancelCountdown,
    showToast,
    updateAudioState,
    setPendingUnmute,
    setInterruptedState
  };
})();
