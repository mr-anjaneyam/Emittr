/**
 * Emittr — Modern Apple-Grade Product Showcase & Interactive Studio Logic
 * High-performance, clean, zero external framework dependencies
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. Audio Engine (Web Audio API - Synthetic Mechanical Sound)
  // ==========================================================================
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.enabled = false;
    }

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      if (this.enabled) this.init();
      return this.enabled;
    }

    playKeyClick() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(550 + Math.random() * 150, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.03);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.035);
      } catch (e) {}
    }

    playReleaseChime() {
      if (!this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.18);
      } catch (e) {}
    }
  }

  const audio = new AudioEngine();

  // ==========================================================================
  // 2. Toast Notification Helper
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
  // 3. Theme Controller (Apple Light / Dark Titanium)
  // ==========================================================================
  function initTheme() {
    const html = document.documentElement;
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');

    const savedTheme = localStorage.getItem('emittr_theme') || 'dark';
    html.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const current = html.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('emittr_theme', next);
        updateThemeIcon(next);
        showToast(`Switched to ${next} mode`, next === 'dark' ? 'dark_mode' : 'light_mode');
      });
    }

    function updateThemeIcon(theme) {
      if (!themeIcon) return;
      themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    }
  }

  // ==========================================================================
  // 4. Sound Toggle Controller
  // ==========================================================================
  function initSoundToggle() {
    const soundToggle = document.getElementById('soundToggle');
    const soundIcon = document.getElementById('soundIcon');
    if (!soundToggle) return;

    soundToggle.addEventListener('click', () => {
      const enabled = audio.toggle();
      if (soundIcon) soundIcon.textContent = enabled ? 'volume_up' : 'volume_off';
      if (enabled) {
        audio.playReleaseChime();
        showToast('Mechanical Switch Audio: Enabled 🔊', 'volume_up');
      } else {
        showToast('Audio Muted', 'volume_off');
      }
    });
  }

  // ==========================================================================
  // 5. Interactive Demo Studio Modal
  // ==========================================================================
  function initDemoModal() {
    const modal = document.getElementById('demoModal');
    const openBtns = [document.getElementById('openDemoBtn'), document.getElementById('heroDemoBtn')];
    const closeBtn = document.getElementById('closeDemoBtn');

    openBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          modal.classList.add('active');
          modal.setAttribute('aria-hidden', 'false');
          document.body.style.overflow = 'hidden';
          audio.playKeyClick();
          showToast('Interactive Studio Ready', 'play_circle');
        });
      }
    });

    function closeModal() {
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      stopTyping();
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  // ==========================================================================
  // 6. Interactive Simulator Logic
  // ==========================================================================
  const essayPreset = `In an era where technology promises frictionless collaboration, the simplest acts often remain the most stubborn. Consider the humble paragraph: five hundred words of structured thought, carefully composed, waiting on one screen to be transferred to another. In theory, modern networks should make this instantaneous. In practice, we encounter air-gapped corporate firewalls, disabled clipboard sharing, guest network barriers, and workstations with USB mass storage ports permanently locked down by enterprise security policies.

This is where the distinction between software and hardware becomes profound. Software asks for permission; hardware simply exists. When an operating system boots, long before high-level networking stacks, cloud synchronization daemons, or security endpoint agents initialize, the kernel queries the physical USB bus. It searches for standard human interface devices: a keyboard and a mouse.

Human Interface Device standards were forged decades ago to be universal, unencumbered, and immortal. A keyboard does not negotiate protocols; it asserts electrical state. It sends an eight-byte report: a modifier byte, a reserved byte, and an array of keycodes representing depressed physical switches. Because this contract is immutable across every computing architecture from industrial programmable logic controllers and legacy server BIOS menus to modern desktop operating systems, it represents the ultimate universal bridge.

By utilizing Linux kernel USB Gadget ConfigFS, our mobile phone ceases to be merely a handheld computer. It becomes an authentic physical input deck. When we command it to type, it does not send high-level text over an insecure Wi-Fi socket; it injects precise, synchronized USB scancodes directly across copper wires. At a cadence of one thousand words per minute, five hundred words materialize across the host screen not as a pasted block that might trigger security filters, but as the relentless, rhythmic arrival of physical keystrokes.

Beyond raw speed, the physical deck restores tactile dignity to everyday tasks. When reviewing an exhaustive spreadsheet containing tens of thousands of rows, modern touchpad gestures often feel disconnected. Dual Xbox-style analog thumbsticks translate continuous rate physics into native horizontal and vertical pan reports, allowing your eyes to glide across dense data architectures effortlessly. When speech recognition captures fleeting spoken insights, your phone translates voice dictation into physical keystrokes directly into your active workstation document.

Technology reaches its peak not when it adds more complexity, but when it bridges existing interfaces with elegance. In the end, hardware truth always triumphs over software friction.`;

  const wifiPreset = `wpa_passphrase "Executive_Secure_5G" "9F#kL$8mP!2vQ@9xR&4tS*7yT%1nU^5eV#3jW$8aB@4cD!7eF#2gH$9jK%3mN^8pQ*1rS"`;
  const codePreset = `sudo apt update && sudo apt install -y build-essential htop iotop dstat
dmesg -wH | grep -i --color=auto usb`;

  let typingTimer = null;
  let isTyping = false;

  function stopTyping() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
    isTyping = false;
    const docCursor = document.getElementById('docCursor');
    if (docCursor) docCursor.style.display = 'inline-block';
    const wpmBadge = document.getElementById('telemetryWpm');
    if (wpmBadge) wpmBadge.textContent = '0 WPM';
  }

  function initSimulator() {
    // Deck tabs
    const deckTabs = document.querySelectorAll('.deck-tab');
    const deckPanes = document.querySelectorAll('.deck-pane');

    deckTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        deckTabs.forEach(t => t.classList.remove('active'));
        deckPanes.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const targetId = `pane-${tab.getAttribute('data-tab')}`;
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');
        audio.playKeyClick();
      });
    });

    // Laptop monitor mode tabs
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
        audio.playKeyClick();
      });

      btnModeGrid.addEventListener('click', () => {
        btnModeGrid.classList.add('active');
        btnModeDoc.classList.remove('active');
        viewGrid.classList.add('active');
        viewDoc.classList.remove('active');
        audio.playKeyClick();
      });
    }

    // Typer controls
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
        else if (val === 'wifi') textContent.value = wifiPreset;
        else if (val === 'code') textContent.value = codePreset;
        audio.playKeyClick();
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

        // Switch laptop view to doc
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

        // Calculate simulated WPM: (chars / 5) / (total_time_in_minutes)
        const estWpm = Math.min(1000, Math.round((60000 / (delayMs * 5))));
        if (telemetryWpm) telemetryWpm.textContent = `${estWpm} WPM`;

        const startTime = Date.now();

        function streamNext() {
          if (!isTyping) return;

          // Stream chunks of chars if delay is tiny (for 1,000 WPM feel)
          const chunkSize = delayMs <= 10 ? 3 : 1;
          const chunk = text.slice(charIndex, charIndex + chunkSize);
          charIndex += chunkSize;

          docTypedContent.textContent += chunk;

          // Update stats
          const charsCount = docTypedContent.textContent.length;
          const wordsCount = docTypedContent.textContent.trim().split(/\s+/).filter(Boolean).length;
          if (docStats) docStats.textContent = `${charsCount} chars • ${wordsCount} words`;

          // Auto-scroll doc viewport
          const docScroll = document.getElementById('docScrollSurface');
          if (docScroll) docScroll.scrollTop = docScroll.scrollHeight;

          // Sound effect occasionally
          if (charIndex % 12 === 0) audio.playKeyClick();

          if (charIndex < totalChars && isTyping) {
            typingTimer = setTimeout(streamNext, delayMs);
          } else {
            isTyping = false;
            showToast('Document streamed at hardware speed! ⚡', 'bolt');
            if (telemetryWpm) telemetryWpm.textContent = '0 WPM';
          }
        }

        streamNext();
      });
    }

    if (btnAbortTyping) {
      btnAbortTyping.addEventListener('click', () => {
        stopTyping();
        showToast('Typing stream paused', 'stop');
      });
    }

    if (simUnstickBtn) {
      simUnstickBtn.addEventListener('click', () => {
        audio.playReleaseChime();
        showToast('Zero-Flush Injected • All Modifiers Released', 'lock_open');
      });
    }

    // Populate data table for joysticks test
    populateDataTable();

    // Init Joysticks
    initSimJoystick('joyWellV', 'joyStickV', 'joyStatusV', 'v');
    initSimJoystick('joyWellH', 'joyStickH', 'joyStatusH', 'h');

    // Init Trackpad
    initSimTrackpad();
  }

  // ==========================================================================
  // 7. Data Grid Generator for Joysticks
  // ==========================================================================
  function populateDataTable() {
    const tbody = document.getElementById('dataTableBody');
    if (!tbody) return;

    const regions = ['North America', 'EMEA', 'Asia Pacific', 'Latin America', 'Nordics'];
    const categories = ['Enterprise Cloud', 'Hardware Security', 'Embedded Systems', 'Network Telemetry'];
    const statuses = ['Optimized', 'Active', 'Monitoring', 'Verified'];

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
        <td style="color:var(--accent-green)">${grow}</td>
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
  // 8. Dual Xbox Joysticks Engine with Continuous Physics
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
          // Auto switch to grid if not active
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
          // dy < 0 is push up -> scroll up (speed positive)
          const dir = clampedY < 0 ? 1 : -1;
          scrollSpeed = dir * Math.round(norm * 14);
          if (status) status.textContent = dir > 0 ? `▲ Scroll Up (${Math.abs(scrollSpeed)})` : `▼ Scroll Down (${Math.abs(scrollSpeed)})`;
        } else {
          scrollSpeed = 0;
          if (status) status.textContent = 'Center';
        }
      } else {
        const clampedX = Math.max(-MAX_RADIUS, Math.min(MAX_RADIUS, dx));
        stick.style.transform = `translate(calc(-50% + ${clampedX}px), -50%)`;

        if (Math.abs(clampedX) > DEADZONE) {
          const norm = (Math.abs(clampedX) - DEADZONE) / (MAX_RADIUS - DEADZONE);
          // dx > 0 is push right -> scroll right (speed positive)
          const dir = clampedX > 0 ? 1 : -1;
          scrollSpeed = dir * Math.round(norm * 14);
          if (status) status.textContent = dir > 0 ? `▶ Pan Right (${Math.abs(scrollSpeed)})` : `◀ Pan Left (${Math.abs(scrollSpeed)})`;
        } else {
          scrollSpeed = 0;
          if (status) status.textContent = 'Center';
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
      audio.playKeyClick();

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
  // 9. Simulated Trackpad
  // ==========================================================================
  function initSimTrackpad() {
    const pad = document.getElementById('simTouchpadSurface');
    const pointer = document.getElementById('simMousePointer');
    const monitor = document.querySelector('.monitor-viewport');
    if (!pad || !pointer || !monitor) return;

    let posX = 50;
    let posY = 50;

    pad.addEventListener('mousemove', (e) => {
      const rect = pad.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const relY = (e.clientY - rect.top) / rect.height;

      posX = Math.max(5, Math.min(95, relX * 100));
      posY = Math.max(5, Math.min(95, relY * 100));

      pointer.style.display = 'block';
      pointer.style.left = `${posX}%`;
      pointer.style.top = `${posY}%`;
    });

    pad.addEventListener('mouseleave', () => {
      pointer.style.display = 'none';
    });

    ['btnSimLeft', 'btnSimMid', 'btnSimRight'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          audio.playKeyClick();
          showToast(`${btn.textContent} Emitted over USB`, 'mouse');
        });
      }
    });
  }

  // ==========================================================================
  // 10. Interactive Bento Mini-Stick Widget
  // ==========================================================================
  function initBentoMiniStick() {
    const stickBox = document.getElementById('bentoMiniStick');
    if (!stickBox) return;
    const dish = stickBox.querySelector('.mini-stick-dish');
    if (!dish) return;

    let isInteracting = false;

    stickBox.addEventListener('mousedown', (e) => {
      isInteracting = true;
      audio.playKeyClick();
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
      const dx = Math.max(-12, Math.min(12, cx - midX));
      const dy = Math.max(-12, Math.min(12, cy - midY));
      dish.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  }

  // ==========================================================================
  // 11. FAQ Accordion
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
          audio.playKeyClick();
        });
      }
    });
  }

  // ==========================================================================
  // 12. Copy Buttons
  // ==========================================================================
  function initCopyButtons() {
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-copy');
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            showToast('Copied command to clipboard! 📋', 'check_circle');
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
    initSoundToggle();
    initDemoModal();
    initSimulator();
    initBentoMiniStick();
    initFaq();
    initCopyButtons();
  });

})();
