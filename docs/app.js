/**
 * Emittr — Product Page Interactions
 * Zero external framework dependencies. Shared by index.html and docs.html;
 * every init function no-ops if its target elements aren't on the page.
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. Toast Notification Helper
  // ==========================================================================
  const toastBox = document.getElementById('toastBox');
  let toastTimer = null;

  function showToast(message, icon = 'info') {
    if (!toastBox) return;
    toastBox.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${message}</span>`;
    toastBox.classList.add('active');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastBox.classList.remove('active');
    }, 2800);
  }

  // ==========================================================================
  // 3. Theme Controller — dark by default, remembered per visitor,
  //    with a circular reveal ("ripple") transition on toggle.
  // ==========================================================================
  function initTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    const savedTheme = localStorage.getItem('emittr_theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (themeToggle) {
      themeToggle.addEventListener('click', (e) => applyThemeChange(e.currentTarget));
    }

    function applyThemeChange(originBtn) {
      const current = html.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';

      const commit = () => {
        html.setAttribute('data-theme', next);
        localStorage.setItem('emittr_theme', next);
        updateThemeIcon(next);
      };

      if (!document.startViewTransition || !originBtn) {
        commit();
        showToast(`Switched to ${next} mode`, next === 'dark' ? 'dark_mode' : 'light_mode');
        return;
      }

      const rect = originBtn.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const transition = document.startViewTransition(commit);

      transition.ready.then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 600,
            easing: 'ease-in-out',
            pseudoElement: '::view-transition-new(root)',
          }
        );
      });

      transition.finished.then(() => {
        showToast(`Switched to ${next} mode`, next === 'dark' ? 'dark_mode' : 'light_mode');
      });
    }

    function updateThemeIcon(theme) {
      if (!themeIcon) return;
      themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  }

  // ==========================================================================
  // 5. Full-screen Nav Overlay
  // ==========================================================================
  function initNavOverlay() {
    const fab = document.getElementById('menuFab');
    const overlay = document.getElementById('navOverlay');
    if (!fab || !overlay) return;

    function closeOverlay() {
      fab.classList.remove('active');
      fab.setAttribute('aria-expanded', 'false');
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }

    function openOverlay() {
      fab.classList.add('active');
      fab.setAttribute('aria-expanded', 'true');
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    fab.addEventListener('click', () => {
      if (overlay.classList.contains('active')) closeOverlay();
      else openOverlay();
    });

    overlay.querySelectorAll('[data-nav-link]').forEach((link) => {
      link.addEventListener('click', closeOverlay);
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('active')) closeOverlay();
    });
  }

  // ==========================================================================
  // 6. Dot Navigation (scroll-spy + click-to-jump)
  // ==========================================================================
  function initDotNav() {
    const dotNav = document.getElementById('dotNav');
    if (!dotNav) return;
    const dots = Array.from(dotNav.querySelectorAll('.dot-nav-item'));
    const sections = dots
      .map((dot) => document.querySelector(dot.getAttribute('data-target')))
      .filter(Boolean);

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const target = document.querySelector(dot.getAttribute('data-target'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    });

    if (!sections.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = sections.indexOf(entry.target);
          if (idx === -1) return;
          dots.forEach((d) => d.classList.remove('active'));
          dots[idx].classList.add('active');
        });
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
  }

  // ==========================================================================
  // 7. Story Section Scroll Reveal
  // ==========================================================================
  function initStoryReveal() {
    const lines = document.querySelectorAll('[data-reveal]');
    if (!lines.length || !('IntersectionObserver' in window)) {
      lines.forEach((l) => l.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-visible');
        });
      },
      { threshold: 0.6 }
    );

    lines.forEach((line) => observer.observe(line));
  }

  // ==========================================================================
  // 8. Demo Scroll Button (hero CTA jumps to embedded demo)
  // ==========================================================================
  function initDemoScrollBtn() {
    const btn = document.getElementById('demoScrollBtn');
    const demo = document.getElementById('demo');
    if (!btn || !demo) return;
    btn.addEventListener('click', () => demo.scrollIntoView({ behavior: 'smooth' }));
  }

  // ==========================================================================
  // 9. Footer Rotating Tagline
  // ==========================================================================
  function initFooterTagline() {
    const el = document.getElementById('footerTagline');
    if (!el) return;
    const taglines = [
      'Built at 2am. Works during the day.',
      'No frameworks were harmed in the making of this page.',
      'MIT licensed. Sarcasm included at no extra cost.',
      'Tested on real computers. Mostly.',
      'Your phone called. It wants a raise.',
    ];
    el.textContent = taglines[Math.floor(Math.random() * taglines.length)];
  }

  // ==========================================================================
  // 10. Docs Page — Table of Contents scroll-spy
  // ==========================================================================
  function initDocsToc() {
    const toc = document.querySelector('.docs-toc');
    if (!toc) return;
    const links = Array.from(toc.querySelectorAll('a'));
    const sections = links
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    if (!sections.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = sections.indexOf(entry.target);
          if (idx === -1) return;
          links.forEach((l) => l.classList.remove('active'));
          links[idx].classList.add('active');
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
  }

  // ==========================================================================
  // 11. Interactive Simulator Logic (embedded demo)
  // ==========================================================================
  const essayPreset = `In an era where technology promises frictionless collaboration, the simplest acts often remain the most stubborn. Consider the humble paragraph: five hundred words of structured thought, carefully composed, waiting on one screen to be transferred to another. In theory, modern networks should make this instantaneous. In practice, we encounter locked-down corporate networks, disabled clipboard sharing, guest network barriers, and workstations with USB ports restricted by security policy.

This is where the distinction between software and hardware becomes meaningful. Software asks for permission; hardware simply exists. When a computer starts up, long before any network stack or security agent initializes, it looks for a keyboard and a mouse.

By using the phone you already carry as a genuine physical input device, typing stops depending on the network entirely. A five-hundred-word document doesn't arrive as a pasted block that might be filtered — it arrives as the steady, natural rhythm of real keystrokes.`;

  const passwordPreset = `Th1s-Is-An-Ex4mple-Of-A-Very-L0ng-Complex-Passphrase-2026!Emittr#Secure*9247`;
  const notePreset = `Reminder: the quarterly review moves to Thursday at 2pm. Please bring the updated forecast and the two open action items from last week.`;

  let typingTimer = null;
  let isTyping = false;

  function stopTyping() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    isTyping = false;
    const wpmBadge = document.getElementById('telemetryWpm');
    if (wpmBadge) wpmBadge.textContent = '0 WPM';
  }

  function initSimulator() {
    const deckTabs = document.querySelectorAll('.deck-tab');
    const deckPanes = document.querySelectorAll('.deck-pane');
    if (!deckTabs.length) return;

    deckTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        deckTabs.forEach(t => t.classList.remove('active'));
        deckPanes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = `pane-${tab.getAttribute('data-tab')}`;
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');
      });
    });

    const btnModeDoc = document.getElementById('btnModeDoc');
    const btnModeGrid = document.getElementById('btnModeGrid');
    const viewDoc = document.getElementById('viewDoc');
    const viewGrid = document.getElementById('viewGrid');

    if (btnModeDoc && btnModeGrid) {
      btnModeDoc.addEventListener('click', () => {
        btnModeDoc.classList.add('active');
        btnModeGrid.classList.remove('active');
        viewDoc.classList.add('active');
        viewGrid.classList.remove('active');
      });

      btnModeGrid.addEventListener('click', () => {
        btnModeGrid.classList.add('active');
        btnModeDoc.classList.remove('active');
        viewGrid.classList.add('active');
        viewDoc.classList.remove('active');
      });
    }

    const presetSelect = document.getElementById('essayPresetSelect');
    const textContent = document.getElementById('simTextContent');
    const speedRange = document.getElementById('simSpeedRange');
    const speedLabel = document.getElementById('simSpeedLabel');
    const btnStartTyping = document.getElementById('btnStartTyping');
    const btnAbortTyping = document.getElementById('btnAbortTyping');

    const docTypedContent = document.getElementById('docTypedContent');
    const docStats = document.getElementById('docStats');
    const telemetryWpm = document.getElementById('telemetryWpm');
    const simUnstickBtn = document.getElementById('simUnstickBtn');

    if (textContent) textContent.value = essayPreset;

    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        const val = presetSelect.value;
        if (val === 'essay') textContent.value = essayPreset;
        else if (val === 'wifi') textContent.value = passwordPreset;
        else if (val === 'code') textContent.value = notePreset;
      });
    }

    if (speedRange && speedLabel) {
      speedRange.addEventListener('input', () => {
        const ms = parseInt(speedRange.value, 10);
        let tag = 'Instant';
        if (ms < 15) tag = 'Lightning';
        else if (ms < 30) tag = 'Fast';
        else if (ms < 50) tag = 'Normal';
        else tag = 'Human';
        speedLabel.textContent = `${tag} (${ms}ms)`;
      });
    }

    if (btnStartTyping && docTypedContent) {
      btnStartTyping.addEventListener('click', () => {
        if (isTyping) stopTyping();

        if (btnModeDoc && !btnModeDoc.classList.contains('active')) {
          btnModeDoc.click();
        }

        const text = textContent.value || '';
        if (!text) return;

        docTypedContent.textContent = '';
        isTyping = true;
        let charIndex = 0;
        const totalChars = text.length;
        const delayMs = parseInt(speedRange.value, 10) || 5;

        const estWpm = Math.min(1000, Math.round((60000 / (delayMs * 5))));
        if (telemetryWpm) telemetryWpm.textContent = `${estWpm} WPM`;

        function streamNext() {
          if (!isTyping) return;

          const chunkSize = delayMs <= 10 ? 3 : 1;
          const chunk = text.slice(charIndex, charIndex + chunkSize);
          charIndex += chunkSize;

          docTypedContent.textContent += chunk;

          const charsCount = docTypedContent.textContent.length;
          const wordsCount = docTypedContent.textContent.trim().split(/\s+/).filter(Boolean).length;
          if (docStats) docStats.textContent = `${charsCount} chars • ${wordsCount} words`;

          const docScroll = document.getElementById('docScrollSurface');
          if (docScroll) docScroll.scrollTop = docScroll.scrollHeight;

          if (charIndex < totalChars && isTyping) {
            typingTimer = setTimeout(streamNext, delayMs);
          } else {
            isTyping = false;
            showToast('Streamed at hardware speed', 'bolt');
            if (telemetryWpm) telemetryWpm.textContent = '0 WPM';
          }
        }

        streamNext();
      });
    }

    if (btnAbortTyping) {
      btnAbortTyping.addEventListener('click', () => {
        stopTyping();
        showToast('Typing stopped', 'stop');
      });
    }

    if (simUnstickBtn) {
      simUnstickBtn.addEventListener('click', () => {
        showToast('All keys released', 'lock_open');
      });
    }

    populateDataTable();

    initSimJoystick('joyWellV', 'joyStickV', 'joyStatusV', 'v');
    initSimJoystick('joyWellH', 'joyStickH', 'joyStatusH', 'h');

    initSimTrackpad();
  }

  // ==========================================================================
  // 12. Data Grid Generator (spreadsheet demo pane)
  // ==========================================================================
  function populateDataTable() {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;

    const regions = ['North America', 'EMEA', 'Asia Pacific', 'Latin America', 'Nordics'];
    const categories = ['Product', 'Services', 'Support', 'Infrastructure'];
    const statuses = ['On Track', 'Active', 'Reviewing', 'Verified'];

    let rowsHtml = '';
    for (let i = 1; i <= 60; i++) {
      const reg = regions[i % regions.length];
      const cat = categories[i % categories.length];
      const rev = (120000 + (i * 3420)).toLocaleString();
      const grow = '+' + ((i * 1.7) % 35 + 2).toFixed(1) + '%';
      const stat = statuses[i % statuses.length];
      rowsHtml += `<tr>
        <td>#${String(i).padStart(4, '0')}</td>
        <td>${reg}</td>
        <td>${cat}</td>
        <td>$${rev}</td>
        <td style="color:var(--good)">${grow}</td>
        <td>+0.4%</td>
        <td>42.8%</td>
        <td>${stat}</td>
        <td>$34,200</td>
        <td>$48,900</td>
        <td>$52,100</td>
        <td>$61,800</td>
        <td>$280,000</td>
        <td>Low</td>
      </tr>`;
    }
    tbody.innerHTML = rowsHtml;
  }

  // ==========================================================================
  // 13. Dual-Stick Scroll Engine
  // ==========================================================================
  function initSimJoystick(wellId, stickId, statusId, axis) {
    const well = document.getElementById(wellId);
    const stick = document.getElementById(stickId);
    const status = document.getElementById(statusId);
    const gridScroll = document.getElementById('gridScrollSurface');
    const btnModeGrid = document.getElementById('btnModeGrid');

    if (!well || !stick) return;

    const MAX_RADIUS = 24;
    const DEADZONE = 4;

    let isDragging = false;
    let centerX = 0;
    let centerY = 0;
    let scrollSpeed = 0;
    let loopTimer = null;

    function startScrollLoop() {
      if (loopTimer) clearInterval(loopTimer);
      loopTimer = setInterval(() => {
        if (scrollSpeed !== 0 && gridScroll) {
          if (btnModeGrid && !btnModeGrid.classList.contains('active')) {
            btnModeGrid.click();
          }

          if (axis === 'v') {
            gridScroll.scrollTop -= scrollSpeed;
          } else {
            gridScroll.scrollLeft += scrollSpeed;
          }
        }
      }, 35);
    }

    function stopScrollLoop() {
      if (loopTimer) {
        clearInterval(loopTimer);
        loopTimer = null;
      }
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const dx = clientX - centerX;
      const dy = clientY - centerY;

      if (axis === 'v') {
        const clampedY = Math.max(-MAX_RADIUS, Math.min(MAX_RADIUS, dy));
        stick.style.transform = `translate(-50%, calc(-50% + ${clampedY}px))`;

        if (Math.abs(clampedY) > DEADZONE) {
          const norm = (Math.abs(clampedY) - DEADZONE) / (MAX_RADIUS - DEADZONE);
          const dir = clampedY < 0 ? 1 : -1;
          scrollSpeed = dir * Math.round(norm * 14);
          if (status) status.textContent = dir > 0 ? `Scrolling up` : `Scrolling down`;
        } else {
          scrollSpeed = 0;
          if (status) status.textContent = 'Centered';
        }
      } else {
        const clampedX = Math.max(-MAX_RADIUS, Math.min(MAX_RADIUS, dx));
        stick.style.transform = `translate(calc(-50% + ${clampedX}px), -50%)`;

        if (Math.abs(clampedX) > DEADZONE) {
          const norm = (Math.abs(clampedX) - DEADZONE) / (MAX_RADIUS - DEADZONE);
          const dir = clampedX > 0 ? 1 : -1;
          scrollSpeed = dir * Math.round(norm * 14);
          if (status) status.textContent = dir > 0 ? `Panning right` : `Panning left`;
        } else {
          scrollSpeed = 0;
          if (status) status.textContent = 'Centered';
        }
      }
    }

    function onPointerEnd() {
      if (!isDragging) return;
      isDragging = false;
      scrollSpeed = 0;
      stopScrollLoop();
      well.classList.remove('dragging');
      stick.style.transform = 'translate(-50%, -50%)';
      if (status) status.textContent = axis === 'v' ? 'Push up / down' : 'Push left / right';
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerEnd);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerEnd);
    }

    function onPointerStart(e) {
      e.preventDefault();
      isDragging = true;
      const rect = well.getBoundingClientRect();
      centerX = rect.left + rect.width / 2;
      centerY = rect.top + rect.height / 2;

      well.classList.add('dragging');

      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerEnd);
      window.addEventListener('touchmove', onPointerMove);
      window.addEventListener('touchend', onPointerEnd);

      startScrollLoop();
    }

    well.addEventListener('mousedown', onPointerStart);
    well.addEventListener('touchstart', onPointerStart, { passive: false });
  }

  // ==========================================================================
  // 14. Simulated Trackpad
  // ==========================================================================
  function initSimTrackpad() {
    const pad = document.getElementById('simTouchpadSurface');
    const pointer = document.getElementById('simMousePointer');
    const monitor = document.querySelector('.monitor-viewport');
    const dot = document.getElementById('touchpadDot');
    const hint = pad ? pad.querySelector('.touchpad-hint') : null;
    if (!pad || !pointer || !monitor) return;

    function updatePositions(clientX, clientY) {
      const rect = pad.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;

      // dot stays visible inside the well so gliding is felt where you touch
      if (dot) {
        dot.style.display = 'block';
        dot.style.left = `${Math.max(3, Math.min(97, relX * 100))}%`;
        dot.style.top = `${Math.max(3, Math.min(97, relY * 100))}%`;
      }
      if (hint) hint.style.opacity = '0';

      const posX = Math.max(5, Math.min(95, relX * 100));
      const posY = Math.max(5, Math.min(95, relY * 100));
      pointer.style.display = 'block';
      pointer.style.left = `${posX}%`;
      pointer.style.top = `${posY}%`;
    }

    function resetPositions() {
      pointer.style.display = 'none';
      if (dot) dot.style.display = 'none';
      if (hint) hint.style.opacity = '1';
    }

    pad.addEventListener('mousemove', (e) => updatePositions(e.clientX, e.clientY));
    pad.addEventListener('mouseleave', resetPositions);

    pad.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) updatePositions(touch.clientX, touch.clientY);
    }, { passive: false });
    pad.addEventListener('touchend', resetPositions);

    ['btnSimLeft', 'btnSimMid', 'btnSimRight'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          showToast(`${btn.textContent} click sent`, 'mouse');
        });
      }
    });
  }

  // ==========================================================================
  // 15. Interactive Feature Widget (dual-stick preview in the features section)
  // ==========================================================================
  function initBentoMiniStick() {
    const stickBox = document.getElementById('bentoMiniStick');
    if (!stickBox) return;
    const dish = stickBox.querySelector('.mini-stick-dish');
    if (!dish) return;

    let isInteracting = false;

    stickBox.addEventListener('mousedown', (e) => {
      isInteracting = true;
      updateStick(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!isInteracting) return;
      updateStick(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      if (!isInteracting) return;
      isInteracting = false;
      dish.style.transform = 'translate(0, 0)';
    });

    function updateStick(cx, cy) {
      const rect = stickBox.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const midY = rect.top + rect.height / 2;
      const dx = Math.max(-24, Math.min(24, cx - midX));
      const dy = Math.max(-24, Math.min(24, cy - midY));
      dish.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  // ==========================================================================
  // 16. FAQ Accordion
  // ==========================================================================
  function initFaq() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const btn = item.querySelector('.faq-question');
      if (btn) {
        btn.addEventListener('click', () => {
          const isOpen = item.classList.contains('open');
          faqItems.forEach(i => i.classList.remove('open'));
          if (!isOpen) item.classList.add('open');
        });
      }
    });
  }

  // ==========================================================================
  // 17. Copy Buttons
  // ==========================================================================
  function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-copy');
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard', 'check_circle');
            const icon = btn.querySelector('.material-symbols-outlined');
            if (icon) {
              const orig = icon.textContent;
              icon.textContent = 'done';
              setTimeout(() => { icon.textContent = orig; }, 2000);
            }
          });
        }
      });
    });
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavOverlay();
    initDotNav();
    initStoryReveal();
    initDemoScrollBtn();
    initFooterTagline();
    initDocsToc();
    initSimulator();
    initBentoMiniStick();
    initFaq();
    initCopyButtons();
  });

})();
