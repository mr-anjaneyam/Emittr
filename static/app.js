/**
 * Emittr: Web App Controller v2.0.0
 * Tactical USB HID Controller: Dual Xbox Joysticks, Universal Dashboard Mode,
 * Native AC Pan Horizontal Scroll, IME Keyboard Mirror, and Windows Shortcuts Deck.
 */

'use strict';

const APP_VERSION = '2.0.0';

const State = {
  ws: null,
  reconnectTimer: null,
  connected: false,
  isTyping: false,
  delayMs: 15,
  sensitivity: 1.0,
  macros: [],
  categories: [],
  activeCategory: 'all',
  quickCategory: 'all',
  sheets: [],
  activeSheetId: null,
  sheetEditMode: false,
  sheetDraft: null,
  sheetLastSent: null,
  config: {
    autoclear: true,
    haptic: true,
    countdown: 0,
    autoenter: false,
    sensitivity: 15,
    theme: 'dark'
  }
};

document.addEventListener('DOMContentLoaded', () => {
  initServiceWorker();
  initIntroAnimation();
  loadConfig();
  initVersionBadge();
  initWebSocket();
  initLatencyMonitor();
  initTextareaCounter();
  initLiveKeyboard();
  initJoysticks();
  initTrackpad();
  fetchInitialStatus();
  initMacros();
  initSheets();
});

// ── PWA Service Worker Registration ───────────────────────────────────────

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      navigator.serviceWorker.register('/static/sw.js').catch(() => {});
    });
  }
}

// ── Opening Intro Animation ───────────────────────────────────────────────

function initIntroAnimation() {
  const introEl = document.getElementById('intro');
  if (!introEl) return;
  const timer = setTimeout(() => {
    document.body.classList.add('ready');
  }, 3100);

  // Tap or click anywhere to dismiss immediately
  introEl.addEventListener('click', () => {
    clearTimeout(timer);
    document.body.classList.add('ready');
  });
}

// ── Version Badge Initialization ──────────────────────────────────────────

function initVersionBadge(ver) {
  const v = ver || APP_VERSION;
  document.querySelectorAll('.version-badge').forEach(el => {
    el.textContent = v.startsWith('v') ? v : 'v' + v;
  });
  const hwVer = document.getElementById('hw-ver');
  if (hwVer) hwVer.textContent = v.startsWith('v') ? v : 'v' + v;
}

// ── Config Management & Dashboard Preference ──────────────────────────────

function loadConfig() {
  const saved = localStorage.getItem('emittr_cfg');
  if (saved) {
    try { State.config = Object.assign(State.config, JSON.parse(saved)); } catch (e) {}
  }
  document.getElementById('cfg-autoclear').checked = State.config.autoclear;
  document.getElementById('cfg-haptic').checked    = State.config.haptic;
  document.getElementById('cfg-countdown').value   = State.config.countdown;
  document.getElementById('cfg-autoenter').checked = State.config.autoenter;
  document.getElementById('cfg-theme').checked     = State.config.theme !== 'light';
  applyTheme(State.config.theme);

  // Sensitivity
  const rawSens = State.config.sensitivity ?? 15;
  document.getElementById('cfg-sensitivity').value = rawSens;
  State.sensitivity = rawSens / 15.0;
  document.getElementById('sensitivity-val').innerText = `${State.sensitivity.toFixed(1)}×`;

  // Typing Delay
  const savedDelay = localStorage.getItem('emittr_delay');
  if (savedDelay) {
    const d = parseInt(savedDelay, 10);
    if (!isNaN(d)) {
      State.delayMs = d;
      updatePresetPills(d);
    }
  }

  // Restore Dashboard Mode preference across all screen sizes
  const isDash = localStorage.getItem('emittr_dashboard') === 'true';
  if (isDash) {
    document.body.classList.add('dashboard-mode');
    updateDashboardUI(true);
  }
}

function saveConfig() {
  State.config.autoclear   = document.getElementById('cfg-autoclear').checked;
  State.config.haptic      = document.getElementById('cfg-haptic').checked;
  State.config.countdown   = parseInt(document.getElementById('cfg-countdown').value, 10) || 0;
  State.config.autoenter   = document.getElementById('cfg-autoenter').checked;
  State.config.sensitivity = parseInt(document.getElementById('cfg-sensitivity').value, 10);
  localStorage.setItem('emittr_cfg', JSON.stringify(State.config));
}

function onSensitivityChange(val) {
  const raw = parseInt(val, 10);
  State.sensitivity = raw / 15.0;
  document.getElementById('sensitivity-val').innerText = `${State.sensitivity.toFixed(1)}×`;
  saveConfig();
}

function toggleTheme() {
  const isDark = document.getElementById('cfg-theme').checked;
  State.config.theme = isDark ? 'dark' : 'light';
  applyTheme(State.config.theme);
  saveConfig();
}

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
}

function triggerHaptic(duration = 10) {
  if (State.config.haptic && navigator.vibrate) {
    try { navigator.vibrate(duration); } catch (e) {}
  }
}

// ── Emergency Unstick Keys ────────────────────────────────────────────────

async function emergencyRelease() {
  triggerHaptic(25);
  showToast('🚨 Releasing all stuck keys & modifiers...');

  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    State.ws.send(JSON.stringify({ action: 'release_all' }));
  }

  try {
    await fetch('/api/release', { method: 'POST' });
    showToast('✓ All keys & modifiers released');
  } catch (e) {
    showToast('Sent release signal');
  }
}

// ── Universal Dashboard Mode ──────────────────────────────────────────────

function toggleDashboardMode() {
  const isDash = document.body.classList.toggle('dashboard-mode');
  updateDashboardUI(isDash);
  localStorage.setItem('emittr_dashboard', String(isDash));
  triggerHaptic(14);
  showToast(isDash ? 'Dashboard Mode: All panels active' : 'Tab View active');
}

function updateDashboardUI(active) {
  const btnDesk = document.getElementById('btn-dashboard-mode');
  const navDash = document.getElementById('nav-dashboard');
  if (btnDesk) btnDesk.classList.toggle('active', active);
  if (navDash) navDash.classList.toggle('active', active);
}

// ── WebSocket & Status Monitor ────────────────────────────────────────────

function initWebSocket() {
  if (State.reconnectTimer) { clearTimeout(State.reconnectTimer); State.reconnectTimer = null; }
  if (State.ws && (State.ws.readyState === WebSocket.CONNECTING ||
                   State.ws.readyState === WebSocket.OPEN)) return;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  State.ws = new WebSocket(`${protocol}//${location.host}/ws`);

  State.ws.onopen = () => {
    if (State.reconnectTimer) { clearTimeout(State.reconnectTimer); State.reconnectTimer = null; }
  };

  State.ws.onmessage = (event) => {
    try { handleWsMessage(JSON.parse(event.data)); } catch (e) {}
  };

  State.ws.onclose = () => {
    if (!State.reconnectTimer) {
      State.reconnectTimer = setTimeout(() => { State.reconnectTimer = null; initWebSocket(); }, 2000);
    }
  };

  State.ws.onerror = () => { try { State.ws.close(); } catch (e) {} };
}

function handleWsMessage(msg) {
  if (msg.type === 'pong') {
    const now = performance.now();
    const rtt = Math.max(1, Math.round(now - (msg.t || lastPingTime || now)));
    finishPing(rtt);
  } else if (msg.type === 'status' || msg.type === 'connection_change') {
    updateConnectionUI(msg.data);
    if (lastPingTime && isPinging) {
      const rtt = Math.max(1, Math.round(performance.now() - lastPingTime));
      finishPing(rtt);
    }
  } else if (msg.type === 'typing_start') {
    setTypingUI(true, msg.total);
  } else if (msg.type === 'typing_end') {
    setTypingUI(false);
    if (msg.aborted) {
      showToast('Typing aborted');
    } else {
      showToast('Finished typing text');
      if (State.config.autoclear) {
        document.getElementById('text-input').value = '';
        updateCharCount();
      }
    }
  } else if (msg.type === 'countdown') {
    showToast(`Typing starts in ${msg.remaining}s...`);
  }
}

async function fetchInitialStatus() {
  try {
    const data = await (await fetch('/api/status')).json();
    updateConnectionUI(data);
  } catch (e) {}
}

function updateConnectionUI(data) {
  if (!data) return;
  State.connected = !!data.attached;
  State.usbData   = data;

  const btnStatus  = document.getElementById('btn-status');
  const statusText = document.getElementById('status-pill-text');

  // Modal elements
  const modalHeroTitle = document.getElementById('conn-hero-status');
  const modalHeroSub   = document.getElementById('conn-hero-sub');
  const modalState     = document.getElementById('metric-state');
  const modalStrength  = document.getElementById('metric-strength');
  const modalSpeed     = document.getElementById('metric-speed');
  const modalUdc       = document.getElementById('metric-udc');
  const modalHid       = document.getElementById('metric-hid');

  const speedLabel = data.speed === 'HS' ? 'USB 2.0 High-Speed (480 Mbps)' : (data.speed ? `USB Speed: ${data.speed}` : 'High-Speed USB 2.0 (480 Mbps)');
  const udcLabel   = data.udc || 'hisi-usb-otg';
  const nodeLabel  = data.hid_node || '/dev/hidg0, hidg1';

  const rttText = currentLatency !== null ? ` · ${currentLatency <= 1 ? '< 1 ms' : currentLatency + ' ms'} RTT` : '';

  if (data.attached) {
    if (btnStatus) {
      btnStatus.className = 'status-btn connected';
      btnStatus.title = `Connected (${data.speed || 'HS'})${rttText} - Click for diagnostics`;
    }
    if (statusText) statusText.innerText = 'Connected';
    if (modalHeroTitle) modalHeroTitle.innerText = `Connected (${data.speed || 'High-Speed'})`;
    if (modalHeroSub) modalHeroSub.innerText = 'USB Host Active & Enumerated';
    if (modalState) modalState.innerText = 'Attached';
    if (modalStrength) modalStrength.innerText = '100% Solid';
  } else {
    if (btnStatus) {
      btnStatus.className = 'status-btn waiting';
      btnStatus.title = `Waiting for USB Host${rttText} - Click for diagnostics`;
    }
    if (statusText) statusText.innerText = 'Waiting...';
    if (modalHeroTitle) modalHeroTitle.innerText = 'Waiting for Connection';
    if (modalHeroSub) modalHeroSub.innerText = 'Connect phone to target PC with USB cable';
    if (modalState) modalState.innerText = 'Waiting Host...';
    if (modalStrength) modalStrength.innerText = 'Ready to Link';
  }

  if (modalSpeed) modalSpeed.innerText = speedLabel;
  if (modalUdc) modalUdc.innerText = `UDC: ${udcLabel}`;
  if (modalHid) modalHid.innerText = nodeLabel;

  const udc   = document.getElementById('hw-udc');
  const speed = document.getElementById('hw-speed');
  const node  = document.getElementById('hw-node');
  if (udc)   udc.innerText   = udcLabel;
  if (speed) speed.innerText = data.speed || 'N/A';
  if (node)  node.innerText  = data.hid_node || '/dev/hidg0';

  if (data.version) {
    initVersionBadge(data.version);
  }
}

// ── View Switching & Dashboard Smooth Navigation ──────────────────────────

function switchView(viewName, clickedBtn) {
  if (document.body.classList.contains('dashboard-mode')) {
    // In Dashboard Mode: smoothly scroll to that section without exiting dashboard mode
    const target = document.getElementById('view-' + viewName);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Update bottom navigation & desktop navigation active indicator
    document.querySelectorAll('.nav-item').forEach(b => {
      if (b.id !== 'nav-dashboard') b.classList.toggle('active', b.id === 'nav-' + viewName);
    });
    document.querySelectorAll('.desktop-nav-btn').forEach(b => {
      if (b.dataset.view) b.classList.toggle('active', b.dataset.view === viewName);
    });
    triggerHaptic(10);
    return;
  }

  // Standard single-tab switching
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.desktop-nav-btn').forEach(b => {
    if (b.dataset.view) b.classList.toggle('active', b.dataset.view === viewName);
  });

  const targetPanel = document.getElementById('view-' + viewName);
  if (targetPanel) targetPanel.classList.add('active');

  const bottomNavBtn = document.getElementById('nav-' + viewName);
  if (bottomNavBtn) bottomNavBtn.classList.add('active');

  triggerHaptic(12);
  if (viewName === 'live') setTimeout(focusLiveInput, 150);
}

// ── View 1: Typer ─────────────────────────────────────────────────────────

function initTextareaCounter() {
  document.getElementById('text-input').addEventListener('input', updateCharCount);
}

function updateCharCount() {
  document.getElementById('char-count').innerText =
    `${document.getElementById('text-input').value.length} chars`;
}

function selectPreset(btn, delay) {
  document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  State.delayMs = delay;
  localStorage.setItem('emittr_delay', delay);
  triggerHaptic(8);
}

function updatePresetPills(val) {
  let matched = false;
  document.querySelectorAll('.preset-pill').forEach(p => {
    const isMatch = parseInt(p.dataset.delay, 10) === val;
    p.classList.toggle('active', isMatch);
    if (isMatch) matched = true;
  });
  if (!matched) {
    const fastPill = document.querySelector('.preset-pill[data-delay="15"]');
    if (fastPill) {
      fastPill.classList.add('active');
      State.delayMs = 15;
    }
  }
}

function clearText() {
  document.getElementById('text-input').value = '';
  updateCharCount();
  triggerHaptic(8);
}

async function sendText() {
  let text = document.getElementById('text-input').value;
  if (!text) { showToast('Please enter text to send'); return; }
  if (State.config.autoenter) text += '\n';

  setTypingUI(true, text.length);
  triggerHaptic(15);

  try {
    const res = await fetch('/api/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        delay_ms: State.delayMs,
        initial_delay_s: State.config.countdown
      })
    });
    const result = await res.json();
    if (!result.ok) {
      setTypingUI(false);
      showToast(result.msg || 'Typing failed');
    }
  } catch (e) {
    setTypingUI(false);
    showToast('Failed to reach server');
  }
}

async function stopTyping() {
  try {
    await fetch('/api/stop', { method: 'POST' });
  } catch (e) {}
  setTypingUI(false);
  triggerHaptic(20);
}

function setTypingUI(isTyping, totalChars = 0) {
  State.isTyping = isTyping;
  const btnSend  = document.getElementById('btn-send');
  const btnStop  = document.getElementById('btn-stop');
  const progWrap = document.getElementById('progress-wrapper');
  const progFill = document.getElementById('progress-fill');

  if (isTyping) {
    btnSend.style.display  = 'none';
    btnStop.style.display  = 'flex';
    progWrap.style.display = 'block';
    const totalTimeMs = totalChars * State.delayMs + State.config.countdown * 1000;
    animateProgressBar(totalTimeMs);
  } else {
    btnSend.style.display  = 'flex';
    btnStop.style.display  = 'none';
    progWrap.style.display = 'none';
    progFill.style.width   = '0%';
  }
}

function animateProgressBar(totalTimeMs) {
  const fill = document.getElementById('progress-fill');
  fill.style.transition = 'none';
  fill.style.width      = '0%';
  requestAnimationFrame(() => {
    fill.style.transition = `width ${totalTimeMs}ms linear`;
    fill.style.width      = '100%';
  });
}

// ── View 2: Live Keyboard ─────────────────────────────────────────────────

function toggleKeyFeed() {
  const btn      = document.getElementById('feed-toggle-btn');
  const collapse = document.getElementById('feed-collapse');
  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
  collapse.classList.toggle('collapsed', expanded);
  triggerHaptic(8);
}

function initLiveKeyboard() {
  const input = document.getElementById('live-hidden-input');
  const zone  = document.getElementById('live-target-zone');
  const hint  = document.getElementById('live-hint-text');
  let lastValue = '', resetTimer = null;

  function emitChar(ch) {
    if (!ch) return;
    if (ch === '\n' || ch === '\r') ch = 'Enter';
    sendLiveChar(ch);
  }

  input.addEventListener('focus', () => {
    zone.classList.add('focused');
    hint.innerText = '🟢 Keyboard active: type now';
    input.value = ''; lastValue = '';
  });

  input.addEventListener('blur', () => {
    zone.classList.remove('focused');
    hint.innerText = '⌨️ Tap to open device keyboard';
    input.value = ''; lastValue = '';
  });

  input.addEventListener('keydown', (e) => {
    const specialMap = {
      'Backspace': 'Backspace', 'Enter': 'Enter', 'Tab': 'Tab',
      'Escape': 'Esc', 'ArrowUp': 'up', 'ArrowDown': 'down',
      'ArrowLeft': 'left', 'ArrowRight': 'right',
    };
    if (specialMap[e.key]) {
      emitChar(specialMap[e.key]);
      if (e.key !== 'Backspace' || !input.value) e.preventDefault();
    } else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== 'Unidentified') {
      emitChar(e.key);
      e.preventDefault();
    }
  });

  input.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'insertLineBreak') {
      emitChar('Enter'); e.preventDefault();
    } else if (e.inputType === 'deleteContentBackward') {
      emitChar('Backspace');
    }
  });

  input.addEventListener('input', () => {
    const cur = input.value;
    if (cur.length > lastValue.length) {
      let pfx = 0;
      while (pfx < lastValue.length && pfx < cur.length && lastValue[pfx] === cur[pfx]) pfx++;
      const removed = lastValue.length - pfx;
      for (let i = 0; i < removed; i++) emitChar('Backspace');
      for (const ch of cur.slice(pfx)) emitChar(ch);
    } else if (cur.length < lastValue.length) {
      const diff = lastValue.length - cur.length;
      for (let i = 0; i < diff; i++) emitChar('Backspace');
    }
    lastValue = cur;
    clearTimeout(resetTimer);
    if (cur.length > 25) {
      input.value = ''; lastValue = '';
    } else {
      resetTimer = setTimeout(() => { input.value = ''; lastValue = ''; }, 1500);
    }
  });

  input.addEventListener('compositionend', () => {
    const cur = input.value;
    if (cur.length > lastValue.length) {
      for (const ch of cur.slice(lastValue.length)) emitChar(ch);
    }
    input.value = ''; lastValue = '';
  });
}

function focusLiveInput() {
  document.getElementById('live-hidden-input').focus();
  triggerHaptic(10);
}

function sendLiveChar(ch) {
  triggerHaptic(8);
  appendKeyChip(ch);
  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    State.ws.send(JSON.stringify({ action: 'live_char', char: ch }));
  } else {
    fetch('/api/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ch })
    }).catch(() => {});
  }
}

function appendKeyChip(label) {
  const feed      = document.getElementById('key-feed');
  const emptyHint = feed.querySelector('.empty-feed-hint');
  if (emptyHint) emptyHint.remove();
  const chip     = document.createElement('span');
  chip.className = 'key-chip';
  chip.innerText = label === ' ' ? '␣' : label;
  feed.appendChild(chip);
  while (feed.children.length > 15) feed.removeChild(feed.firstChild);
  feed.scrollLeft = feed.scrollWidth;
}

function clearKeyFeed() {
  document.getElementById('key-feed').innerHTML =
    '<span class="empty-feed-hint">Waiting for input...</span>';
}

function sendSingleKey(keyName) { triggerHaptic(12); sendLiveChar(keyName); }

// ── View 3: Shortcuts ─────────────────────────────────────────────────────

async function sendCombo(combo) {
  triggerHaptic(15);
  showToast(`Sent ${combo}`);
  try {
    await fetch('/api/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ combo })
    });
  } catch (e) {}
}

// ── View 4: Dual Xbox Joystick Thumbsticks Engine ─────────────────────────

function initJoysticks() {
  initOneJoystick('joy-well-v', 'joy-stick-v', 'joy-hint-v', 'v');
  initOneJoystick('joy-well-h', 'joy-stick-h', 'joy-hint-h', 'h');
}

function initOneJoystick(wellId, stickId, hintId, axis) {
  const well  = document.getElementById(wellId);
  const stick = document.getElementById(stickId);
  const hint  = document.getElementById(hintId);
  if (!well || !stick) return;

  const MAX_RADIUS = 26; // Maximum deflection radius in px
  const DEADZONE   = 4;  // Deadzone in px to prevent drifting
  const defaultHint = axis === 'v' ? 'Push up / down to scroll' : 'Push left / right to scroll';

  let isDragging   = false;
  let centerX      = 0;
  let centerY      = 0;
  let activeSpeed  = 0;
  let tickerTimer  = null;

  function updateDeflection(clientX, clientY) {
    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;

    if (axis === 'v') {
      // Constrain primarily to vertical motion with slight horizontal leeway
      const clampedDy = Math.max(-MAX_RADIUS, Math.min(MAX_RADIUS, rawDy));
      const clampedDx = Math.max(-7, Math.min(7, rawDx * 0.25));

      stick.style.transform = `translate(calc(-50% + ${clampedDx}px), calc(-50% + ${clampedDy}px))`;

      well.classList.toggle('deflected-top', clampedDy < -DEADZONE);
      well.classList.toggle('deflected-bottom', clampedDy > DEADZONE);

      if (Math.abs(clampedDy) > DEADZONE) {
        const norm = (Math.abs(clampedDy) - DEADZONE) / (MAX_RADIUS - DEADZONE);
        // Tilt UP (dy < 0) -> scroll UP (positive wheel)
        // Tilt DOWN (dy > 0) -> scroll DOWN (negative wheel)
        const dir = clampedDy < 0 ? 1 : -1;
        const speed = dir * Math.max(1, Math.round(Math.pow(norm, 1.35) * 5 * State.sensitivity));
        activeSpeed = speed;
        if (hint) {
          hint.innerText = (dir > 0 ? '▲ Scroll Up +' : '▼ Scroll Down ') + Math.abs(speed);
        }
      } else {
        activeSpeed = 0;
        if (hint) hint.innerText = defaultHint;
      }
    } else {
      // Constrain primarily to horizontal motion with slight vertical leeway
      const clampedDx = Math.max(-MAX_RADIUS, Math.min(MAX_RADIUS, rawDx));
      const clampedDy = Math.max(-7, Math.min(7, rawDy * 0.25));

      stick.style.transform = `translate(calc(-50% + ${clampedDx}px), calc(-50% + ${clampedDy}px))`;

      well.classList.toggle('deflected-left', clampedDx < -DEADZONE);
      well.classList.toggle('deflected-right', clampedDx > DEADZONE);

      if (Math.abs(clampedDx) > DEADZONE) {
        const norm = (Math.abs(clampedDx) - DEADZONE) / (MAX_RADIUS - DEADZONE);
        // Tilt RIGHT (dx > 0) -> scroll RIGHT (positive AC Pan)
        // Tilt LEFT (dx < 0) -> scroll LEFT (negative AC Pan)
        const dir = clampedDx > 0 ? 1 : -1;
        const speed = dir * Math.max(1, Math.round(Math.pow(norm, 1.35) * 5 * State.sensitivity));
        activeSpeed = speed;
        if (hint) {
          hint.innerText = (dir > 0 ? '▶ Scroll Right +' : '◀ Scroll Left ') + Math.abs(speed);
        }
      } else {
        activeSpeed = 0;
        if (hint) hint.innerText = defaultHint;
      }
    }
  }

  function startScrollTicker() {
    if (tickerTimer) clearInterval(tickerTimer);
    // 70ms tick interval gives smooth, responsive rate-based scrolling
    tickerTimer = setInterval(() => {
      if (activeSpeed !== 0) {
        emitScroll(axis, activeSpeed);
        triggerHaptic(3);
      }
    }, 70);
  }

  function stopScrollTicker() {
    if (tickerTimer) {
      clearInterval(tickerTimer);
      tickerTimer = null;
    }
  }

  function onStart(e) {
    e.preventDefault();
    isDragging = true;
    const rect = well.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;

    well.classList.add('dragging');
    triggerHaptic(10);

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updateDeflection(clientX, clientY);
    startScrollTicker();
  }

  function onMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    updateDeflection(clientX, clientY);
  }

  function onEnd() {
    if (!isDragging) return;
    isDragging  = false;
    activeSpeed = 0;
    stopScrollTicker();

    well.classList.remove('dragging', 'deflected-top', 'deflected-bottom', 'deflected-left', 'deflected-right');
    stick.style.transform = 'translate(-50%, -50%)';
    if (hint) hint.innerText = defaultHint;

    emitScroll(axis, 0);
    triggerHaptic(5);
  }

  // Touch Events
  well.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove,  { passive: false });
  window.addEventListener('touchend',  onEnd,   { passive: false });
  window.addEventListener('touchcancel', onEnd, { passive: false });

  // Mouse Fallback
  well.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);
}

// ── Native Hardware Scrolling Transmitter ─────────────────────────────────

function emitScroll(axis, val) {
  if (val === 0) return;

  if (axis === 'v') {
    // Vertical scroll (Standard Mouse Wheel)
    if (State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_scroll', wheel_v: val, wheel_h: 0 }));
    } else {
      fetch('/api/mouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wheel: val, wheel_h: 0 })
      }).catch(() => {});
    }
  } else {
    // Horizontal scroll (Native HID AC Pan Usage 0x0238)
    if (State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_scroll', wheel_v: 0, wheel_h: val }));
    } else {
      fetch('/api/mouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wheel: 0, wheel_h: val })
      }).catch(() => {});
    }
  }
}

// ── View 4: Touchpad & Two-Finger Gesture Engine ───────────────────────────

function initTrackpad() {
  const surface = document.getElementById('touchpad-surface');
  if (!surface) return;

  let lastX = 0, lastY = 0, startX = 0, startY = 0;
  let lastMidX = 0, lastMidY = 0;
  let accumScrollX = 0, accumScrollY = 0;
  let isMoving = false, tapStartTime = 0;
  let isTwoFinger = false;
  const SCROLL_THRESHOLD = 8; // Pixel distance per scroll tick

  // Touchstart
  surface.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      lastX = startX = e.touches[0].clientX;
      lastY = startY = e.touches[0].clientY;
      isMoving     = true;
      isTwoFinger  = false;
      tapStartTime = Date.now();
    } else if (e.touches.length === 2) {
      isTwoFinger  = true;
      isMoving     = false;
      lastMidX     = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      lastMidY     = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      accumScrollX = 0;
      accumScrollY = 0;
    }
  }, { passive: false });

  // Touchmove
  surface.addEventListener('touchmove', (e) => {
    e.preventDefault();

    // Two-Finger Touchpad Scrolling (Vertical + Horizontal)
    if (e.touches.length === 2) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dX   = midX - lastMidX;
      const dY   = midY - lastMidY;
      lastMidX   = midX;
      lastMidY   = midY;

      accumScrollX += dX * State.sensitivity;
      accumScrollY += dY * State.sensitivity;

      // Vertical two-finger scroll
      while (Math.abs(accumScrollY) >= SCROLL_THRESHOLD) {
        const dirY = accumScrollY > 0 ? 1 : -1;
        accumScrollY -= dirY * SCROLL_THRESHOLD;
        // Dragging fingers down (dirY > 0) scrolls page down (negative HID wheel)
        emitScroll('v', -dirY * 2);
        triggerHaptic(3);
      }

      // Horizontal two-finger scroll
      while (Math.abs(accumScrollX) >= SCROLL_THRESHOLD) {
        const dirX = accumScrollX > 0 ? 1 : -1;
        accumScrollX -= dirX * SCROLL_THRESHOLD;
        // Dragging fingers right (dirX > 0) scrolls page right (positive wheel_h)
        emitScroll('h', dirX * 2);
        triggerHaptic(3);
      }
      return;
    }

    if (!isMoving || e.touches.length !== 1) return;

    // Single finger cursor glide
    const curX = e.touches[0].clientX;
    const curY = e.touches[0].clientY;
    const dx   = Math.round((curX - lastX) * 1.5 * State.sensitivity);
    const dy   = Math.round((curY - lastY) * 1.5 * State.sensitivity);
    lastX = curX; lastY = curY;

    if ((dx || dy) && State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_move', dx, dy, wheel: 0 }));
    }
  }, { passive: false });

  // Touchend (Tap to Left Click)
  surface.addEventListener('touchend', (e) => {
    if (!isTwoFinger && isMoving) {
      const elapsed  = Date.now() - tapStartTime;
      const movedDist = Math.hypot(lastX - startX, lastY - startY);
      if (elapsed < 250 && movedDist < 8) {
        onMouseClick(1);
      }
    }
    isMoving    = false;
    isTwoFinger = false;
  }, { passive: false });

  // Desktop Mouse Glide fallback
  let isMouseDown = false;
  surface.addEventListener('mousedown', (e) => {
    isMouseDown = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    const dx = Math.round((e.clientX - lastX) * 1.5 * State.sensitivity);
    const dy = Math.round((e.clientY - lastY) * 1.5 * State.sensitivity);
    lastX = e.clientX; lastY = e.clientY;
    if ((dx || dy) && State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_move', dx, dy, wheel: 0 }));
    }
  });
  window.addEventListener('mouseup', () => { isMouseDown = false; });

  // Desktop Mouse Wheel on Touchpad Surface
  surface.addEventListener('wheel', (e) => {
    e.preventDefault();
    const isShift = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if (isShift) {
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      const w = Math.sign(delta) * Math.min(Math.abs(Math.round(delta * State.sensitivity / 12)), 6);
      emitScroll('h', w);
    } else {
      const w = -Math.sign(e.deltaY) * Math.min(Math.abs(Math.round(e.deltaY * State.sensitivity / 12)), 6);
      emitScroll('v', w);
    }
  }, { passive: false });
}

function onMouseClick(buttonNum) {
  triggerHaptic(15);
  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    State.ws.send(JSON.stringify({ action: 'mouse_click', button: buttonNum }));
  } else {
    fetch('/api/mouse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buttons: buttonNum })
    }).catch(() => {});
  }
}

// ── Preferences Modal ─────────────────────────────────────────────────────

function openSettings() {
  document.getElementById('settings-modal').classList.add('open');
  triggerHaptic(8);
  fetchInitialStatus();
}

function closeSettings(e) {
  if (e && e.target !== document.getElementById('settings-modal')) return;
  document.getElementById('settings-modal').classList.remove('open');
  triggerHaptic(8);
}

// ── Connection Diagnostics Modal & Latency Test ───────────────────────────

let lastPingTime = 0;
let currentLatency = null;
let latencyInterval = null;
let pingTimeoutId = null;
let isPinging = false;

function initLatencyMonitor() {
  // Initial ping test
  testLatency(true);

  // Update every 10 seconds automatically
  if (latencyInterval) clearInterval(latencyInterval);
  latencyInterval = setInterval(() => {
    testLatency(true);
  }, 10000);

  // Auto-refresh when returning to tab/app
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      testLatency(true);
    }
  });
}

function openConnectionModal() {
  document.getElementById('connection-modal').classList.add('open');
  triggerHaptic(8);
  testLatency();
  fetchInitialStatus();
}

function closeConnectionModal(e) {
  if (e && e.target !== document.getElementById('connection-modal')) return;
  document.getElementById('connection-modal').classList.remove('open');
  triggerHaptic(8);
}

function testLatency(isAuto = false) {
  if (isPinging && !isAuto) return;
  isPinging = true;

  const t0 = performance.now();
  lastPingTime = t0;

  const pingBtn     = document.getElementById('btn-ping-test');
  const latencyPill = document.getElementById('conn-latency-val');
  const metricVal   = document.getElementById('metric-latency');
  const metricHint  = document.getElementById('metric-latency-hint');
  const refreshInd  = document.getElementById('latency-refresh-indicator');

  if (refreshInd) refreshInd.classList.add('spinning');
  if (pingBtn && !isAuto) pingBtn.classList.add('testing');

  if (!isAuto) {
    triggerHaptic(8);
    if (currentLatency === null) {
      if (latencyPill) latencyPill.innerText = 'Testing...';
      if (metricVal)   metricVal.innerText   = '...';
    }
    if (metricHint) metricHint.innerText = 'Measuring packet turnaround...';
  }

  if (pingTimeoutId) clearTimeout(pingTimeoutId);

  let finished = false;
  const complete = (rtt) => {
    if (finished) return;
    finished = true;
    finishPing(rtt);
  };

  // 1. Try WebSocket ping if open
  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    try {
      State.ws.send(JSON.stringify({ action: 'ping', t: t0 }));
    } catch (_) {}

    // Fallback if WS ping response not received within 250ms (or server without ping handler)
    pingTimeoutId = setTimeout(() => {
      if (!finished) {
        const fetchStart = performance.now();
        fetch('/api/status?_t=' + Date.now())
          .then(res => res.json())
          .then(data => {
            const rtt = Math.max(1, Math.round(performance.now() - fetchStart));
            if (data) updateConnectionUI(data);
            complete(rtt);
          })
          .catch(() => complete(null));
      }
    }, 250);
  } else {
    // 2. HTTP ping measurement
    fetch('/api/status?_t=' + Date.now())
      .then(res => res.json())
      .then(data => {
        const rtt = Math.max(1, Math.round(performance.now() - t0));
        if (data) updateConnectionUI(data);
        complete(rtt);
      })
      .catch(() => complete(null));
  }
}

function finishPing(rtt) {
  if (pingTimeoutId) {
    clearTimeout(pingTimeoutId);
    pingTimeoutId = null;
  }
  isPinging = false;
  lastPingTime = 0;

  const pingBtn    = document.getElementById('btn-ping-test');
  const refreshInd = document.getElementById('latency-refresh-indicator');
  if (refreshInd) refreshInd.classList.remove('spinning');
  if (pingBtn) pingBtn.classList.remove('testing');

  applyLatency(rtt);
}

function applyLatency(rtt) {
  currentLatency = rtt;
  const latencyPill = document.getElementById('conn-latency-val');
  const metricVal   = document.getElementById('metric-latency');
  const metricHint  = document.getElementById('metric-latency-hint');
  const btnStatus   = document.getElementById('btn-status');

  if (rtt === null) {
    if (latencyPill) latencyPill.innerText = 'Offline';
    if (metricVal)   metricVal.innerText   = 'Timeout';
    if (metricHint)  metricHint.innerText  = 'No response from server';
  } else {
    const text = rtt <= 1 ? '< 1 ms' : `${rtt} ms`;
    if (latencyPill) {
      latencyPill.innerText = text;
      latencyPill.classList.remove('ping-pop');
      void latencyPill.offsetWidth;
      latencyPill.classList.add('ping-pop');
    }
    if (metricVal) {
      metricVal.innerText = text;
      metricVal.classList.remove('ping-pop');
      void metricVal.offsetWidth;
      metricVal.classList.add('ping-pop');
    }
    if (metricHint) {
      if (rtt < 8) metricHint.innerText = '⚡ Ultra-Low · 10s auto-refresh';
      else if (rtt < 25) metricHint.innerText = '✓ Nominal · 10s auto-refresh';
      else metricHint.innerText = '⚠ Elevated Link · 10s auto-refresh';
    }
    if (btnStatus && State.connected) {
      btnStatus.title = `Connected (${State.usbData?.speed || 'HS'}) · ${text} RTT - Click for diagnostics`;
    }
  }
}

// ── Toast Utility ─────────────────────────────────────────────────────────

let _toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}


// -- Macros Feature Controller ---------------------------------------------

async function initMacros() {
  try {
    const [macrosRes, catRes] = await Promise.all([
      fetch('/api/macros'),
      fetch('/api/categories').catch(() => null)
    ]);
    const data = await macrosRes.json();
    if (data.ok && Array.isArray(data.macros)) {
      State.macros = data.macros;
    }

    if (catRes) {
      const catData = await catRes.json();
      if (catData.ok && Array.isArray(catData.categories)) {
        State.categories = catData.categories;
      }
    }

    if (!State.categories || State.categories.length === 0) {
      const counts = {};
      State.macros.forEach(m => {
        const c = (m.category || 'General').trim();
        counts[c] = (counts[c] || 0) + 1;
      });
      State.categories = Object.keys(counts).sort().map(name => ({ name, count: counts[name] }));
    }

    renderCategoryTabs();
    renderCategoryDatalist();
    renderQuickCategorySelect();
    filterMacros();
    renderQuickMacros();
  } catch (e) {
    console.warn('Failed to load macros from server:', e);
  }
}

function renderCategoryTabs() {
  const container = document.getElementById('macro-category-tabs');
  if (!container) return;

  const total = State.macros.length;
  const isAll = State.activeCategory === 'all';

  let html = `
    <button type="button" class="category-tab ${isAll ? 'active' : ''}" onclick="selectCategory('all')">
      <span>All</span>
      <span class="category-tab-badge">${total}</span>
    </button>
  `;

  State.categories.forEach(cat => {
    const isActive = State.activeCategory.toLowerCase() === cat.name.toLowerCase();
    const safeName = escapeHtml(cat.name);
    html += `
      <button type="button" class="category-tab ${isActive ? 'active' : ''}" onclick="selectCategory('${escapeHtml(cat.name).replace(/'/g, "\\'")}')">
        <span>📁 ${safeName}</span>
        <span class="category-tab-badge">${cat.count}</span>
      </button>
    `;
  });

  container.innerHTML = html;
}

function renderCategoryDatalist() {
  const datalist = document.getElementById('macro-category-datalist');
  if (!datalist) return;
  datalist.innerHTML = State.categories.map(c => `<option value="${escapeHtml(c.name)}"></option>`).join('');
}

function renderQuickCategorySelect() {
  const select = document.getElementById('quick-category-select');
  if (!select) return;

  const currentVal = State.quickCategory || 'all';
  let options = `<option value="all">All Folders (${State.macros.length})</option>`;

  State.categories.forEach(cat => {
    options += `<option value="${escapeHtml(cat.name)}">📁 ${escapeHtml(cat.name)} (${cat.count})</option>`;
  });

  select.innerHTML = options;
  if (Array.from(select.options).some(o => o.value.toLowerCase() === currentVal.toLowerCase())) {
    select.value = currentVal;
  } else {
    select.value = 'all';
    State.quickCategory = 'all';
  }
}

function onQuickCategoryChange(val) {
  State.quickCategory = val;
  renderQuickMacros();
}

function selectCategory(catName) {
  State.activeCategory = catName;
  renderCategoryTabs();

  const banner = document.getElementById('macro-category-banner');
  const titleEl = document.getElementById('macro-current-category-name');
  const countEl = document.getElementById('macro-current-category-count');

  if (catName === 'all') {
    if (banner) banner.style.display = 'none';
  } else {
    if (banner) {
      banner.style.display = 'flex';
      if (titleEl) titleEl.innerText = catName;
      const count = State.macros.filter(m => (m.category || 'General').toLowerCase() === catName.toLowerCase()).length;
      if (countEl) countEl.innerText = `${count} item${count === 1 ? '' : 's'}`;
    }
  }

  filterMacros();
}

function renderSingleMacroCard(m, showCategoryBadge) {
  const safeName = escapeHtml(m.name);
  const safeText = escapeHtml(m.text);
  const safeCat = escapeHtml(m.category || 'General');
  const actionAfter = m.action_after || (m.auto_enter ? 'enter' : 'none');
  const delayS = m.delay_s || 0;
  const isHotkey = m.type === 'hotkey';

  let actionBadge = '';
  if (isHotkey) {
    actionBadge = `<span class="macro-badge badge-hotkey" title="Multi-Key Keyboard Shortcut">⚡ HOTKEY</span>`;
  } else if (actionAfter === 'tab') {
    actionBadge = '<span class="macro-badge badge-tab" title="Presses Tab to move to next field">⇥ Tab</span>';
  } else if (actionAfter === 'enter') {
    actionBadge = '<span class="macro-badge badge-enter" title="Presses Enter after typing">↵ Enter</span>';
  }

  const catBadge = showCategoryBadge
    ? `<span class="macro-badge badge-cat" title="Folder: ${safeCat}">📁 ${safeCat}</span>`
    : '';

  const textDisplay = isHotkey
    ? `<span style="font-family:monospace;font-weight:700;color:var(--md-sys-color-primary);letter-spacing:0.5px;">${safeText.toUpperCase()}</span>`
    : safeText;

  const btnLabel = isHotkey ? 'Send' : 'Type';
  const btnIcon = isHotkey
    ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>'
    : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

  return `
    <div class="macro-card ${isHotkey ? 'macro-card-hotkey' : ''}" id="macro-card-${m.id}">
      <div class="macro-card-top">
        <div class="macro-card-title-group">
          <span class="macro-card-name" title="${safeName}">${safeName}</span>
          <div class="macro-badges-row">
            ${catBadge}
            ${actionBadge}
            ${delayS > 0 ? `<span class="macro-badge badge-delay">⏳ ${delayS}s</span>` : ''}
          </div>
        </div>
        <button class="macro-run-btn" onclick="runMacro('${m.id}')" title="${isHotkey ? 'Trigger shortcut combo' : 'Auto-type to PC'}">
          ${btnIcon}
          <span>${btnLabel}</span>
        </button>
      </div>
      <div class="macro-card-text" title="${safeText}">${textDisplay}</div>
      <div class="macro-card-bottom">
        <span style="font-size:10px;color:var(--md-sys-color-outline);">${isHotkey ? 'Shortcut Combo' : `${m.text.length} chars`}</span>
        <div class="macro-card-tools">
          <button class="macro-icon-btn" onclick="duplicateMacro('${m.id}')" title="Duplicate macro">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button class="macro-icon-btn" onclick="editMacro('${m.id}')" title="Edit macro">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button class="macro-icon-btn delete-btn" onclick="deleteMacro('${m.id}')" title="Delete macro">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderMacros(list) {
  const grid = document.getElementById('macros-grid');
  const countBadge = document.getElementById('macros-count-badge');
  if (countBadge) {
    countBadge.innerText = `${list.length} macro${list.length === 1 ? '' : 's'}`;
  }
  if (!grid) return;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="macros-empty-state" style="grid-column: 1 / -1;">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="currentColor" style="opacity:0.35;">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        <p>No macros found. Click <strong>+ New</strong> to create one or select another folder.</p>
      </div>
    `;
    return;
  }

  const query = (document.getElementById('macros-search-input')?.value || '').trim();
  const shouldGroup = (State.activeCategory === 'all' && !query);

  if (shouldGroup) {
    const groups = {};
    list.forEach(m => {
      const cat = (m.category || 'General').trim();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(m);
    });

    let html = '';
    Object.keys(groups).sort().forEach(catName => {
      const catMacros = groups[catName];
      const safeCat = escapeHtml(catName);
      html += `
        <div class="macro-group-header">
          <div class="macro-group-title">
            <span>📁 ${safeCat}</span>
            <span class="macro-group-count">(${catMacros.length})</span>
          </div>
          <button type="button" class="macro-group-add-btn" onclick="openNewMacroModal('${safeCat.replace(/'/g, "\\'")}')">+ Add to folder</button>
        </div>
      `;
      catMacros.forEach(m => {
        html += renderSingleMacroCard(m, false);
      });
    });
    grid.innerHTML = html;
  } else {
    grid.innerHTML = list.map(m => renderSingleMacroCard(m, State.activeCategory === 'all')).join('');
  }
}

function renderQuickMacros() {
  const bar = document.getElementById('macros-quick-bar');
  if (!bar) return;

  let list = State.macros;
  const qCat = State.quickCategory || 'all';

  if (qCat !== 'all') {
    list = list.filter(m => (m.category || 'General').toLowerCase() === qCat.toLowerCase());
  }

  if (list.length === 0) {
    bar.innerHTML = '<span style="font-size:11px;color:var(--md-sys-color-outline);padding:4px 0;">No macros in this folder.</span>';
    return;
  }

  bar.innerHTML = list.slice(0, 12).map(m => {
    const action = m.action_after || (m.auto_enter ? 'enter' : 'none');
    const suffix = action === 'tab' ? ' ⇥' : (action === 'enter' ? ' ↵' : '');
    return `
      <button type="button" class="macro-chip" onclick="runMacro('${m.id}')" title="${escapeHtml(m.name)}: ${escapeHtml(m.text)}">
        <span class="macro-chip-dot"></span>
        <span>${escapeHtml(m.name)}${suffix}</span>
      </button>
    `;
  }).join('');
}

function filterMacros() {
  const query = (document.getElementById('macros-search-input')?.value || '').toLowerCase().trim();
  const activeCat = State.activeCategory;

  let filtered = State.macros;

  if (activeCat !== 'all') {
    filtered = filtered.filter(m => (m.category || 'General').toLowerCase() === activeCat.toLowerCase());
  }

  if (query) {
    filtered = filtered.filter(m =>
      (m.name || '').toLowerCase().includes(query) ||
      (m.text || '').toLowerCase().includes(query) ||
      (m.category || '').toLowerCase().includes(query)
    );
  }

  renderMacros(filtered);
}

async function runMacro(id) {
  const macro = State.macros.find(m => m.id === id);
  if (!macro) return;

  if (macro.type === 'hotkey') {
    triggerHaptic(20);
    showToast(`Hotkey Sent: ${macro.text.toUpperCase()}`);
    sendCombo(macro.text);
    return;
  }

  let text = macro.text;
  const action = macro.action_after || (macro.auto_enter ? 'enter' : 'none');
  if (action === 'enter') {
    text += '\n';
  } else if (action === 'tab') {
    text += '\t';
  }

  const delayS = macro.delay_s !== undefined && macro.delay_s !== null ? macro.delay_s : State.config.countdown;
  triggerHaptic(18);

  setTypingUI(true, text.length);
  const actionLabel = action === 'tab' ? ' [Tab ⇥]' : (action === 'enter' ? ' [Enter ↵]' : '');
  showToast(`Typing: ${macro.name}${actionLabel}`);

  try {
    const res = await fetch('/api/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        delay_ms: State.delayMs,
        initial_delay_s: delayS
      })
    });
    const result = await res.json();
    if (!result.ok) {
      setTypingUI(false);
      showToast(result.msg || 'Typing failed');
    }
  } catch (e) {
    setTypingUI(false);
    showToast('Failed to reach server');
  }
}

function setMacroModalType(type) {
  State.macroModalType = type;
  const typeInput = document.getElementById('macro-type-input');
  if (typeInput) typeInput.value = type;

  const btnText = document.getElementById('btn-macro-type-text');
  const btnHk = document.getElementById('btn-macro-type-hotkey');
  const textFields = document.getElementById('macro-text-fields');
  const hkFields = document.getElementById('macro-hotkey-fields');

  if (type === 'hotkey') {
    btnHk?.classList.add('active');
    btnText?.classList.remove('active');
    if (textFields) textFields.style.display = 'none';
    if (hkFields) hkFields.style.display = 'block';
    updateHotkeyPreview();
  } else {
    btnText?.classList.add('active');
    btnHk?.classList.remove('active');
    if (textFields) textFields.style.display = 'block';
    if (hkFields) hkFields.style.display = 'none';
  }
}

function toggleHotkeyMod(mod) {
  if (!State.hotkeyMods) State.hotkeyMods = { ctrl: true, alt: false, shift: false, win: false };
  State.hotkeyMods[mod] = !State.hotkeyMods[mod];
  const chip = document.getElementById(`chip-mod-${mod}`);
  if (chip) chip.classList.toggle('active', State.hotkeyMods[mod]);
  updateHotkeyPreview();
}

function updateHotkeyPreview() {
  if (!State.hotkeyMods) State.hotkeyMods = { ctrl: true, alt: false, shift: false, win: false };
  const keySelect = document.getElementById('hotkey-key-select');
  const key = (keySelect?.value || 'c').toLowerCase();

  const parts = [];
  if (State.hotkeyMods.ctrl) parts.push('Ctrl');
  if (State.hotkeyMods.alt) parts.push('Alt');
  if (State.hotkeyMods.shift) parts.push('Shift');
  if (State.hotkeyMods.win) parts.push('Win');
  parts.push(key.toUpperCase());

  const comboStr = parts.join(' + ');
  const badge = document.getElementById('hotkey-preview-badge');
  if (badge) badge.innerText = comboStr;
}

function applyHotkeyPreset(combo, name) {
  const parts = combo.toLowerCase().split('+');
  if (!State.hotkeyMods) State.hotkeyMods = { ctrl: false, alt: false, shift: false, win: false };
  State.hotkeyMods.ctrl = parts.includes('ctrl');
  State.hotkeyMods.alt = parts.includes('alt');
  State.hotkeyMods.shift = parts.includes('shift');
  State.hotkeyMods.win = parts.includes('win');

  ['ctrl', 'alt', 'shift', 'win'].forEach(m => {
    const chip = document.getElementById(`chip-mod-${m}`);
    if (chip) chip.classList.toggle('active', State.hotkeyMods[m]);
  });

  const mainKey = parts[parts.length - 1];
  const keySelect = document.getElementById('hotkey-key-select');
  if (keySelect) keySelect.value = mainKey;

  const nameInput = document.getElementById('macro-name-input');
  if (nameInput && (!nameInput.value || nameInput.value.trim() === '')) {
    nameInput.value = name;
  }
  const catInput = document.getElementById('macro-category-input');
  if (catInput && (!catInput.value || catInput.value === 'General')) {
    catInput.value = 'Hotkeys';
  }

  updateHotkeyPreview();
  triggerHaptic(10);
}

function openNewMacroModal(presetCategory) {
  document.getElementById('edit-macro-id').value = '';
  document.getElementById('macro-modal-title').innerText = 'New Macro';

  const defaultCat = presetCategory || (State.activeCategory !== 'all' ? State.activeCategory : '');
  document.getElementById('macro-category-input').value = defaultCat;
  document.getElementById('macro-name-input').value = '';
  document.getElementById('macro-text-input').value = '';

  const isCommand = defaultCat.toLowerCase().includes('command') || defaultCat.toLowerCase().includes('script');
  document.getElementById('macro-action-input').value = isCommand ? 'enter' : 'tab';
  document.getElementById('macro-delay-input').value = '0';

  const isHk = defaultCat.toLowerCase().includes('hotkey') || defaultCat.toLowerCase().includes('shortcut');
  setMacroModalType(isHk ? 'hotkey' : 'text');

  document.getElementById('macro-modal').classList.add('open');
  triggerHaptic(10);
  setTimeout(() => {
    if (!defaultCat) {
      document.getElementById('macro-category-input').focus();
    } else {
      document.getElementById('macro-name-input').focus();
    }
  }, 120);
}

function duplicateMacro(id) {
  const macro = State.macros.find(m => m.id === id);
  if (!macro) return;

  document.getElementById('edit-macro-id').value = '';
  document.getElementById('macro-modal-title').innerText = 'Duplicate Macro';
  document.getElementById('macro-category-input').value = macro.category || 'General';
  document.getElementById('macro-name-input').value = `${macro.name} (Copy)`;
  document.getElementById('macro-text-input').value = macro.text;

  const action = macro.action_after || (macro.auto_enter ? 'enter' : 'none');
  document.getElementById('macro-action-input').value = action;
  document.getElementById('macro-delay-input').value = String(macro.delay_s || 0);

  setMacroModalType(macro.type === 'hotkey' ? 'hotkey' : 'text');
  if (macro.type === 'hotkey') {
    applyHotkeyPreset(macro.text, `${macro.name} (Copy)`);
  }

  document.getElementById('macro-modal').classList.add('open');
  triggerHaptic(10);
  setTimeout(() => document.getElementById('macro-name-input').focus(), 120);
}

function editMacro(id) {
  const macro = State.macros.find(m => m.id === id);
  if (!macro) return;

  document.getElementById('edit-macro-id').value = macro.id;
  document.getElementById('macro-modal-title').innerText = 'Edit Macro';
  document.getElementById('macro-category-input').value = macro.category || 'General';
  document.getElementById('macro-name-input').value = macro.name;
  document.getElementById('macro-text-input').value = macro.text;

  const action = macro.action_after || (macro.auto_enter ? 'enter' : 'none');
  document.getElementById('macro-action-input').value = action;
  document.getElementById('macro-delay-input').value = String(macro.delay_s || 0);

  setMacroModalType(macro.type === 'hotkey' ? 'hotkey' : 'text');
  if (macro.type === 'hotkey') {
    applyHotkeyPreset(macro.text, macro.name);
  }

  document.getElementById('macro-modal').classList.add('open');
  triggerHaptic(10);
  setTimeout(() => document.getElementById('macro-name-input').focus(), 120);
}

function closeMacroModal(e) {
  if (e && e.target !== document.getElementById('macro-modal') && !e.target.classList.contains('close-modal-btn')) {
    return;
  }
  document.getElementById('macro-modal').classList.remove('open');
  triggerHaptic(8);
}

async function saveMacro() {
  const editId = document.getElementById('edit-macro-id').value.trim();
  const category = (document.getElementById('macro-category-input')?.value || 'General').trim() || 'General';
  const name = document.getElementById('macro-name-input').value.trim();
  const macroType = document.getElementById('macro-type-input')?.value || 'text';
  let text = '';

  if (macroType === 'hotkey') {
    const parts = [];
    if (State.hotkeyMods?.ctrl) parts.push('ctrl');
    if (State.hotkeyMods?.alt) parts.push('alt');
    if (State.hotkeyMods?.shift) parts.push('shift');
    if (State.hotkeyMods?.win) parts.push('win');
    const k = (document.getElementById('hotkey-key-select')?.value || 'c').toLowerCase();
    parts.push(k);
    text = parts.join('+');
  } else {
    text = document.getElementById('macro-text-input').value;
  }

  const actionAfter = document.getElementById('macro-action-input')?.value || 'tab';
  const delayS = parseInt(document.getElementById('macro-delay-input').value, 10) || 0;

  if (!name) {
    showToast('Please enter an identifier / field name');
    document.getElementById('macro-name-input').focus();
    return;
  }
  if (!text) {
    showToast('Please specify text or key combination');
    return;
  }

  const payload = {
    name,
    text,
    type: macroType,
    category,
    action_after: macroType === 'hotkey' ? 'none' : actionAfter,
    auto_enter: (actionAfter === 'enter'),
    delay_s: delayS
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`/api/macros/${encodeURIComponent(editId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/macros', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    const result = await res.json();
    if (result.ok) {
      document.getElementById('macro-modal').classList.remove('open');
      showToast(editId ? 'Macro updated' : 'Macro created');
      await initMacros();
    } else {
      showToast(result.msg || 'Save failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

async function deleteMacro(id) {
  const macro = State.macros.find(m => m.id === id);
  if (!macro) return;
  if (!confirm(`Delete macro "${macro.name}"?`)) return;

  try {
    const res = await fetch(`/api/macros/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.ok) {
      showToast('Macro deleted');
      await initMacros();
    } else {
      showToast(result.msg || 'Delete failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

function renameCurrentCategory() {
  if (State.activeCategory === 'all') return;
  const oldName = State.activeCategory;
  document.getElementById('category-old-name-input').value = oldName;
  document.getElementById('category-new-name-input').value = oldName;
  document.getElementById('category-rename-modal-title').innerText = `Rename "${oldName}"`;
  document.getElementById('category-rename-modal').classList.add('open');
  triggerHaptic(10);
  setTimeout(() => document.getElementById('category-new-name-input').focus(), 120);
}

function closeCategoryRenameModal(e) {
  if (e && e.target !== document.getElementById('category-rename-modal') && !e.target.classList.contains('close-modal-btn')) {
    return;
  }
  document.getElementById('category-rename-modal').classList.remove('open');
  triggerHaptic(8);
}

async function confirmRenameCategory() {
  const oldName = document.getElementById('category-old-name-input').value.trim();
  const newName = document.getElementById('category-new-name-input').value.trim();

  if (!newName) {
    showToast('Please enter a new name');
    document.getElementById('category-new-name-input').focus();
    return;
  }
  if (oldName.toLowerCase() === newName.toLowerCase()) {
    closeCategoryRenameModal();
    return;
  }

  try {
    const res = await fetch(`/api/categories/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newName })
    });
    const result = await res.json();
    if (result.ok) {
      document.getElementById('category-rename-modal').classList.remove('open');
      showToast(`Renamed folder to "${newName}"`);
      State.activeCategory = newName;
      if (State.quickCategory.toLowerCase() === oldName.toLowerCase()) {
        State.quickCategory = newName;
      }
      await initMacros();
    } else {
      showToast(result.msg || 'Rename failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

async function deleteCurrentCategory() {
  if (State.activeCategory === 'all') return;
  const catName = State.activeCategory;
  const count = State.macros.filter(m => (m.category || 'General').toLowerCase() === catName.toLowerCase()).length;

  if (!confirm(`Delete folder "${catName}" and all ${count} macro(s) inside it?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/categories/${encodeURIComponent(catName)}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.ok) {
      showToast(`Folder "${catName}" deleted`);
      State.activeCategory = 'all';
      if (State.quickCategory.toLowerCase() === catName.toLowerCase()) {
        State.quickCategory = 'all';
      }
      await initMacros();
    } else {
      showToast(result.msg || 'Delete failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

function exportMacros() {
  const jsonStr = JSON.stringify(State.macros, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `emittr-macros-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Macros exported');
  triggerHaptic(12);
}

function downloadMacroTemplateCSV() {
  const a = document.createElement('a');
  a.href = '/api/macros/template.csv';
  a.download = 'emittr-macros-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Macro CSV template downloaded');
  triggerHaptic(12);
}

function downloadSheetTemplateCSV() {
  const a = document.createElement('a');
  a.href = '/api/sheets/template.csv';
  a.download = 'emittr-sheet-template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Sheet CSV template downloaded');
  triggerHaptic(12);
}

function triggerImportMacros() {
  const fileInput = document.getElementById('macro-file-input');
  if (fileInput) fileInput.click();
}

async function handleMacroFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    let macrosToImport = [];

    const trimmed = text.trim();
    const isJson = file.name.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{');

    if (isJson) {
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        macrosToImport = data;
      } else if (data && Array.isArray(data.macros)) {
        macrosToImport = data.macros;
      } else {
        showToast('Invalid JSON file format (expected list)');
        return;
      }
    } else {
      // Parse CSV
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        showToast('CSV file is empty or missing data rows');
        return;
      }

      const parseLine = (line) => {
        const res = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (ch === ',' && !inQuotes) {
            res.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        res.push(cur.trim());
        return res;
      };

      const rawHeaders = parseLine(lines[0]);
      // Normalize header names (strip BOM, lowercase, trim)
      const headers = rawHeaders.map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase());

      let catIdx = headers.findIndex(h => h.includes('cat') || h.includes('folder') || h.includes('group') || h.includes('person'));
      let nameIdx = headers.findIndex(h => h === 'name' || h.includes('title') || h.includes('label') || h.includes('macro'));
      let textIdx = headers.findIndex(h => h === 'text' || h.includes('content') || h.includes('keystroke') || h.includes('value'));
      let actIdx = headers.findIndex(h => h.includes('action') || h.includes('after') || h.includes('suffix'));
      let delayIdx = headers.findIndex(h => h.includes('delay') || h.includes('wait'));

      // Sensible column fallbacks
      if (headers.length >= 3) {
        if (catIdx === -1) catIdx = 0;
        if (nameIdx === -1) nameIdx = 1;
        if (textIdx === -1) textIdx = 2;
      } else if (headers.length === 2) {
        if (nameIdx === -1) nameIdx = 0;
        if (textIdx === -1) textIdx = 1;
      }

      for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        if (row.length === 0 || row.every(c => c === '')) continue;

        const name = (nameIdx >= 0 && row[nameIdx]) ? row[nameIdx] : (row[1] || row[0] || `Macro ${i}`);
        const macroText = (textIdx >= 0 && row[textIdx] !== undefined) ? row[textIdx] : (row[2] || row[1] || '');
        const category = (catIdx >= 0 && row[catIdx]) ? row[catIdx] : 'General';

        let actionAfter = 'tab';
        if (actIdx >= 0 && row[actIdx]) {
          const act = row[actIdx].trim().toLowerCase();
          if (act.includes('enter') || act.includes('return')) actionAfter = 'enter';
          else if (act.includes('none') || act.includes('raw')) actionAfter = 'none';
          else if (act.includes('tab')) actionAfter = 'tab';
        }

        let delay_s = 0;
        if (delayIdx >= 0 && row[delayIdx]) {
          const parsed = parseInt(row[delayIdx], 10);
          if (!isNaN(parsed)) delay_s = Math.max(0, Math.min(60, parsed));
        }

        if (name && macroText !== undefined && macroText !== '') {
          macrosToImport.push({
            name,
            text: macroText,
            category: category || 'General',
            action_after: actionAfter,
            auto_enter: actionAfter === 'enter',
            delay_s
          });
        }
      }
    }

    if (macrosToImport.length === 0) {
      showToast('No valid macros found to import');
      return;
    }

    const res = await fetch('/api/macros/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ macros: macrosToImport, mode: 'merge' })
    });
    const result = await res.json();
    if (result.ok) {
      showToast(`Imported ${result.count} macros (${result.total || result.count} total)`);
      await initMacros();
      triggerHaptic(14);
    } else {
      showToast(result.msg || 'Import failed');
    }
  } catch (e) {
    console.error('Macro import error:', e);
    showToast('Failed to parse import file');
  } finally {
    event.target.value = '';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


// -- Macro Sheets Feature Controller ---------------------------------------

async function initSheets() {
  try {
    const res = await fetch('/api/sheets');
    const data = await res.json();
    if (data.ok && Array.isArray(data.sheets)) {
      State.sheets = data.sheets;
    }
  } catch (e) {
    console.warn('Failed to load sheets from server:', e);
  }

  if (!State.sheets || State.sheets.length === 0) {
    State.sheets = [
      {
        id: 'sheet_sample',
        name: 'Personal Directory',
        columns: ['Name', 'address', 'Ph. no', 'ID'],
        rows: [
          ['Rahul', 'India', '999', '123'],
          ['XYZ', 'Pune', '989', '124']
        ]
      }
    ];
  }

  const savedActive = localStorage.getItem('emittr_active_sheet_id');
  if (savedActive && State.sheets.some(s => s.id === savedActive)) {
    State.activeSheetId = savedActive;
  } else {
    State.activeSheetId = State.sheets[0].id;
  }

  renderSheetSelector();
  renderActiveSheet();
  renderCheatSheet();

  document.addEventListener('click', (e) => {
    const menu = document.getElementById('sheet-options-dropdown');
    const wrapper = document.querySelector('.sheet-menu-wrapper');
    if (menu && menu.style.display !== 'none' && wrapper && !wrapper.contains(e.target)) {
      menu.style.display = 'none';
    }
  });
}

function getActiveSheet() {
  return State.sheets.find(s => s.id === State.activeSheetId) || State.sheets[0] || null;
}

function renderSheetSelector() {
  const select = document.getElementById('active-sheet-select');
  const badge = document.getElementById('sheet-meta-badge');
  if (!select) return;

  select.innerHTML = State.sheets.map(s => `
    <option value="${escapeHtml(s.id)}" ${s.id === State.activeSheetId ? 'selected' : ''}>
      ${escapeHtml(s.name)}
    </option>
  `).join('');

  const current = getActiveSheet();
  if (current && badge) {
    const rowCount = current.rows ? current.rows.length : 0;
    const colCount = current.columns ? current.columns.length : 0;
    badge.innerText = `${rowCount} row${rowCount === 1 ? '' : 's'} • ${colCount} col${colCount === 1 ? '' : 's'}`;
  }
}

function onActiveSheetChange(id) {
  State.activeSheetId = id;
  localStorage.setItem('emittr_active_sheet_id', id);
  State.sheetEditMode = false;
  State.sheetDraft = null;
  updateSheetModeUI();
  renderSheetSelector();
  renderActiveSheet();
  triggerHaptic(8);
}

function toggleSheetEditMode() {
  const sheet = getActiveSheet();
  if (!sheet) return;

  State.sheetEditMode = !State.sheetEditMode;
  if (State.sheetEditMode) {
    State.sheetDraft = JSON.parse(JSON.stringify(sheet));
  } else {
    State.sheetDraft = null;
  }

  updateSheetModeUI();
  renderActiveSheet();
  triggerHaptic(10);
}

function updateSheetModeUI() {
  const modeBtnText = document.getElementById('sheet-mode-btn-text');
  const fillControls = document.getElementById('sheet-fill-controls');
  const editControls = document.getElementById('sheet-edit-controls');

  if (State.sheetEditMode) {
    if (modeBtnText) modeBtnText.innerText = 'Exit Edit';
    if (fillControls) fillControls.style.display = 'none';
    if (editControls) editControls.style.display = 'flex';
  } else {
    if (modeBtnText) modeBtnText.innerText = 'Edit Table';
    if (fillControls) fillControls.style.display = 'flex';
    if (editControls) editControls.style.display = 'none';
  }
}

function renderActiveSheet() {
  const table = document.getElementById('sheet-table');
  if (!table) return;

  const sheet = State.sheetEditMode ? State.sheetDraft : getActiveSheet();
  if (!sheet) {
    table.innerHTML = '<tr><td style="padding:24px;text-align:center;color:var(--md-sys-color-outline);">No sheets created yet. Click "+ New Sheet" above.</td></tr>';
    return;
  }

  const columns = sheet.columns || [];
  const rows = sheet.rows || [];

  if (State.sheetEditMode) {
    let thead = '<thead><tr>';
    thead += '<th class="sheet-th-action" style="width:50px;">#</th>';

    columns.forEach((col, cIdx) => {
      thead += `
        <th>
          <div class="sheet-th-input-wrap">
            <input type="text" class="sheet-th-input" value="${escapeHtml(col)}" onchange="updateDraftColumnName(${cIdx}, this.value)" placeholder="Col name" spellcheck="false" />
            ${columns.length > 1 ? `<button type="button" class="sheet-col-del-btn" onclick="deleteSheetColumn(${cIdx})" title="Delete column">✕</button>` : ''}
          </div>
        </th>
      `;
    });
    thead += '</tr></thead>';

    let tbody = '<tbody>';
    rows.forEach((row, rIdx) => {
      tbody += `<tr>`;
      tbody += `
        <td class="sheet-td-action" style="width:50px;">
          <button type="button" class="sheet-row-del-btn" onclick="deleteSheetRow(${rIdx})" title="Delete row">✕</button>
        </td>
      `;
      columns.forEach((_, cIdx) => {
        const val = row[cIdx] || '';
        tbody += `
          <td>
            <input type="text" class="sheet-cell-input" data-row="${rIdx}" data-col="${cIdx}" value="${escapeHtml(val)}" oninput="updateDraftCell(${rIdx}, ${cIdx}, this.value)" placeholder="Enter value..." spellcheck="false" />
          </td>
        `;
      });
      tbody += `</tr>`;
    });
    tbody += '</tbody>';

    table.innerHTML = thead + tbody;
  } else {
    const filterQuery = (document.getElementById('sheet-filter-input')?.value || '').toLowerCase().trim();

    let thead = '<thead><tr>';
    thead += '<th class="sheet-th-action" title="Sequential row keystroke sender">Row Fill</th>';
    columns.forEach(col => {
      thead += `<th>${escapeHtml(col)}</th>`;
    });
    thead += '</tr></thead>';

    let tbody = '<tbody>';
    let visibleRows = 0;

    rows.forEach((row, rIdx) => {
      if (filterQuery) {
        const rowText = row.join(' ').toLowerCase();
        if (!rowText.includes(filterQuery)) return;
      }
      visibleRows++;

      tbody += `<tr>`;
      tbody += `
        <td class="sheet-td-action">
          <button type="button" class="sheet-row-btn" onclick="typeSheetRow(${rIdx})" title="Type all cells in row sequentially with Tab">
            <span>▶ ${rIdx + 1}</span>
          </button>
        </td>
      `;

      columns.forEach((_, cIdx) => {
        const rawVal = row[cIdx] || '';
        const isLastSent = (State.sheetLastSent?.r === rIdx && State.sheetLastSent?.c === cIdx);
        const cellDisplay = rawVal ? escapeHtml(rawVal) : '<span class="sheet-cell-empty">(empty)</span>';

        tbody += `
          <td>
            <button type="button" class="sheet-cell-btn ${isLastSent ? 'last-sent' : ''}" id="cell-btn-${rIdx}-${cIdx}" onclick="typeSheetCell(${rIdx}, ${cIdx})" title="${escapeHtml(columns[cIdx])}: ${escapeHtml(rawVal)}">
              <span>${cellDisplay}</span>
            </button>
          </td>
        `;
      });
      tbody += `</tr>`;
    });

    if (visibleRows === 0) {
      tbody += `<tr><td colspan="${columns.length + 1}" style="padding:24px;text-align:center;color:var(--md-sys-color-outline);">No matching rows found in this sheet.</td></tr>`;
    }
    tbody += '</tbody>';

    table.innerHTML = thead + tbody;
  }
}

function filterSheetTable() {
  if (!State.sheetEditMode) {
    renderActiveSheet();
  }
}

async function typeSheetCell(rIdx, cIdx) {
  const sheet = getActiveSheet();
  if (!sheet || !sheet.rows || !sheet.rows[rIdx]) return;

  const rawVal = sheet.rows[rIdx][cIdx] || '';
  const action = document.getElementById('sheet-cell-action-select')?.value || 'tab';

  let textToSend = rawVal;
  if (action === 'tab') {
    textToSend += '\t';
  } else if (action === 'enter') {
    textToSend += '\n';
  }

  const btn = document.getElementById(`cell-btn-${rIdx}-${cIdx}`);
  if (btn) {
    btn.classList.add('active-pulse');
    setTimeout(() => btn.classList.remove('active-pulse'), 300);
  }

  State.sheetLastSent = { r: rIdx, c: cIdx };
  document.querySelectorAll('.sheet-cell-btn.last-sent').forEach(b => b.classList.remove('last-sent'));
  if (btn) btn.classList.add('last-sent');

  triggerHaptic(18);
  const colName = sheet.columns[cIdx] || `Col ${cIdx + 1}`;
  const actionLabel = action === 'tab' ? ' [Tab ⇥]' : (action === 'enter' ? ' [Enter ↵]' : '');
  showToast(`Typing ${colName}: "${rawVal}"${actionLabel}`);

  setTypingUI(true, textToSend.length);

  try {
    const res = await fetch('/api/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToSend,
        delay_ms: State.delayMs,
        initial_delay_s: 0
      })
    });
    const result = await res.json();
    if (!result.ok) {
      setTypingUI(false);
      showToast(result.msg || 'Typing failed');
    }
  } catch (e) {
    setTypingUI(false);
    showToast('Failed to reach server');
  }
}

async function typeSheetRow(rIdx) {
  const sheet = getActiveSheet();
  if (!sheet || !sheet.rows || !sheet.rows[rIdx]) return;

  const row = sheet.rows[rIdx];
  const action = document.getElementById('sheet-cell-action-select')?.value || 'tab';

  let textToSend = row.join('\t');
  if (action === 'enter') {
    textToSend += '\n';
  } else if (action === 'tab') {
    textToSend += '\t';
  }

  triggerHaptic(25);
  showToast(`Typing row #${rIdx + 1} (${row.length} fields)`);
  setTypingUI(true, textToSend.length);

  try {
    const res = await fetch('/api/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToSend,
        delay_ms: State.delayMs,
        initial_delay_s: 0
      })
    });
    const result = await res.json();
    if (!result.ok) {
      setTypingUI(false);
      showToast(result.msg || 'Typing row failed');
    }
  } catch (e) {
    setTypingUI(false);
    showToast('Failed to reach server');
  }
}

function updateDraftColumnName(cIdx, val) {
  if (!State.sheetDraft || !State.sheetDraft.columns) return;
  State.sheetDraft.columns[cIdx] = val.trim() || `Col ${cIdx + 1}`;
}

function updateDraftCell(rIdx, cIdx, val) {
  if (!State.sheetDraft || !State.sheetDraft.rows || !State.sheetDraft.rows[rIdx]) return;
  State.sheetDraft.rows[rIdx][cIdx] = val;
}

function addSheetRow() {
  if (!State.sheetDraft) return;
  const colCount = State.sheetDraft.columns.length;
  State.sheetDraft.rows.push(new Array(colCount).fill(''));
  renderActiveSheet();
  triggerHaptic(8);
}

function deleteSheetRow(rIdx) {
  if (!State.sheetDraft || !State.sheetDraft.rows) return;
  State.sheetDraft.rows.splice(rIdx, 1);
  renderActiveSheet();
  triggerHaptic(8);
}

function addSheetColumn() {
  if (!State.sheetDraft) return;
  const colName = prompt('Enter new column header name:', `Col ${State.sheetDraft.columns.length + 1}`);
  if (!colName) return;

  State.sheetDraft.columns.push(colName.trim());
  State.sheetDraft.rows.forEach(r => r.push(''));
  renderActiveSheet();
  triggerHaptic(8);
}

function deleteSheetColumn(cIdx) {
  if (!State.sheetDraft || State.sheetDraft.columns.length <= 1) {
    showToast('A sheet must have at least one column');
    return;
  }
  const colName = State.sheetDraft.columns[cIdx];
  if (!confirm(`Delete column "${colName}" and all data in it?`)) return;

  State.sheetDraft.columns.splice(cIdx, 1);
  State.sheetDraft.rows.forEach(r => r.splice(cIdx, 1));
  renderActiveSheet();
  triggerHaptic(8);
}

function cancelSheetEdit() {
  State.sheetEditMode = false;
  State.sheetDraft = null;
  updateSheetModeUI();
  renderActiveSheet();
  triggerHaptic(8);
}

async function saveSheetEdit() {
  if (!State.sheetDraft) return;

  document.querySelectorAll('.sheet-th-input').forEach((input, cIdx) => {
    if (State.sheetDraft.columns[cIdx] !== undefined) {
      State.sheetDraft.columns[cIdx] = input.value.trim() || `Col ${cIdx + 1}`;
    }
  });

  document.querySelectorAll('.sheet-cell-input').forEach(input => {
    const rIdx = parseInt(input.dataset.row, 10);
    const cIdx = parseInt(input.dataset.col, 10);
    if (State.sheetDraft.rows[rIdx] && State.sheetDraft.rows[rIdx][cIdx] !== undefined) {
      State.sheetDraft.rows[rIdx][cIdx] = input.value;
    }
  });

  const sheetId = State.sheetDraft.id;

  try {
    const res = await fetch(`/api/sheets/${encodeURIComponent(sheetId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        columns: State.sheetDraft.columns,
        rows: State.sheetDraft.rows
      })
    });
    const result = await res.json();
    if (result.ok) {
      showToast('Sheet changes saved');
      const idx = State.sheets.findIndex(s => s.id === sheetId);
      if (idx !== -1) {
        State.sheets[idx] = result.sheet;
      }
      State.sheetEditMode = false;
      State.sheetDraft = null;
      updateSheetModeUI();
      renderSheetSelector();
      renderActiveSheet();
      triggerHaptic(12);
    } else {
      showToast(result.msg || 'Save failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

function toggleSheetMenu(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('sheet-options-dropdown');
  if (!dropdown) return;
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  triggerHaptic(6);
}

function openNewSheetModal() {
  document.getElementById('new-sheet-name-input').value = '';
  document.getElementById('new-sheet-columns-input').value = 'Name, Address, Ph. no, ID';
  document.getElementById('new-sheet-initial-rows').value = '3';
  document.getElementById('new-sheet-modal').classList.add('open');
  triggerHaptic(10);
  setTimeout(() => document.getElementById('new-sheet-name-input').focus(), 120);
}

function closeNewSheetModal(e) {
  if (e && e.target !== document.getElementById('new-sheet-modal') && !e.target.classList.contains('close-modal-btn')) {
    return;
  }
  document.getElementById('new-sheet-modal').classList.remove('open');
  triggerHaptic(8);
}

async function confirmCreateNewSheet() {
  const name = document.getElementById('new-sheet-name-input').value.trim() || 'Untitled Sheet';
  const colsStr = document.getElementById('new-sheet-columns-input').value.trim();
  const rowCount = parseInt(document.getElementById('new-sheet-initial-rows').value, 10) || 3;

  const columns = colsStr ? colsStr.split(',').map(c => c.trim()).filter(Boolean) : ['Col 1', 'Col 2', 'Col 3'];
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push(new Array(columns.length).fill(''));
  }

  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, columns, rows })
    });
    const result = await res.json();
    if (result.ok) {
      document.getElementById('new-sheet-modal').classList.remove('open');
      showToast(`Sheet "${name}" created`);
      State.sheets.push(result.sheet);
      State.activeSheetId = result.sheet.id;
      localStorage.setItem('emittr_active_sheet_id', result.sheet.id);
      State.sheetEditMode = true;
      State.sheetDraft = JSON.parse(JSON.stringify(result.sheet));
      updateSheetModeUI();
      renderSheetSelector();
      renderActiveSheet();
      triggerHaptic(12);
    } else {
      showToast(result.msg || 'Create failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

function openRenameSheetModal() {
  const current = getActiveSheet();
  if (!current) return;
  document.getElementById('sheet-options-dropdown').style.display = 'none';
  document.getElementById('rename-sheet-name-input').value = current.name;
  document.getElementById('rename-sheet-modal').classList.add('open');
  triggerHaptic(10);
  setTimeout(() => document.getElementById('rename-sheet-name-input').focus(), 120);
}

function closeRenameSheetModal(e) {
  if (e && e.target !== document.getElementById('rename-sheet-modal') && !e.target.classList.contains('close-modal-btn')) {
    return;
  }
  document.getElementById('rename-sheet-modal').classList.remove('open');
  triggerHaptic(8);
}

async function confirmRenameSheet() {
  const current = getActiveSheet();
  if (!current) return;
  const newName = document.getElementById('rename-sheet-name-input').value.trim();
  if (!newName) {
    showToast('Please enter a name');
    document.getElementById('rename-sheet-name-input').focus();
    return;
  }

  try {
    const res = await fetch(`/api/sheets/${encodeURIComponent(current.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    const result = await res.json();
    if (result.ok) {
      document.getElementById('rename-sheet-modal').classList.remove('open');
      showToast(`Sheet renamed to "${newName}"`);
      current.name = newName;
      renderSheetSelector();
      renderActiveSheet();
      triggerHaptic(10);
    } else {
      showToast(result.msg || 'Rename failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

async function duplicateCurrentSheet() {
  const current = getActiveSheet();
  if (!current) return;
  document.getElementById('sheet-options-dropdown').style.display = 'none';

  const newName = `${current.name} (Copy)`;
  try {
    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        columns: current.columns,
        rows: current.rows
      })
    });
    const result = await res.json();
    if (result.ok) {
      showToast(`Duplicated as "${newName}"`);
      State.sheets.push(result.sheet);
      State.activeSheetId = result.sheet.id;
      localStorage.setItem('emittr_active_sheet_id', result.sheet.id);
      renderSheetSelector();
      renderActiveSheet();
      triggerHaptic(12);
    } else {
      showToast(result.msg || 'Duplicate failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

async function deleteCurrentSheet() {
  const current = getActiveSheet();
  if (!current) return;
  document.getElementById('sheet-options-dropdown').style.display = 'none';

  if (!confirm(`Delete sheet "${current.name}"?`)) return;

  try {
    const res = await fetch(`/api/sheets/${encodeURIComponent(current.id)}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.ok) {
      showToast('Sheet deleted');
      State.sheets = State.sheets.filter(s => s.id !== current.id);
      State.activeSheetId = State.sheets.length > 0 ? State.sheets[0].id : null;
      if (State.activeSheetId) {
        localStorage.setItem('emittr_active_sheet_id', State.activeSheetId);
      }
      renderSheetSelector();
      renderActiveSheet();
      triggerHaptic(10);
    } else {
      showToast(result.msg || 'Delete failed');
    }
  } catch (e) {
    showToast('Error communicating with server');
  }
}

function exportSheetCSV() {
  const current = getActiveSheet();
  if (!current) return;
  document.getElementById('sheet-options-dropdown').style.display = 'none';

  const escapeCSV = (val) => {
    const str = String(val === null || val === undefined ? '' : val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [];
  lines.push(current.columns.map(escapeCSV).join(','));
  (current.rows || []).forEach(row => {
    lines.push(row.map(escapeCSV).join(','));
  });

  const csvContent = lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeFilename = current.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  a.download = `emittr-sheet-${safeFilename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Sheet exported as CSV');
  triggerHaptic(10);
}

function triggerImportSheetCSV() {
  document.getElementById('sheet-options-dropdown').style.display = 'none';
  const fileInput = document.getElementById('sheet-file-input');
  if (fileInput) fileInput.click();
}

async function handleSheetFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const fileName = file.name.replace(/\.[^/.]+$/, '');

  try {
    const text = await file.text();

    let columns = [];
    let rows = [];

    if (file.name.endsWith('.json')) {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        columns = Object.keys(parsed[0]);
        rows = parsed.map(obj => columns.map(k => String(obj[k] || '')));
      } else if (parsed.columns && Array.isArray(parsed.rows)) {
        columns = parsed.columns;
        rows = parsed.rows;
      }
    } else {
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length > 0) {
        const parseLine = (line) => {
          const res = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (ch === ',' && !inQuotes) {
              res.push(cur.trim());
              cur = '';
            } else {
              cur += ch;
            }
          }
          res.push(cur.trim());
          return res;
        };

        columns = parseLine(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          rows.push(parseLine(lines[i]));
        }
      }
    }

    if (!columns || columns.length === 0) {
      showToast('Could not find column headers in file');
      return;
    }

    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fileName || 'Imported Sheet',
        columns,
        rows
      })
    });
    const result = await res.json();
    if (result.ok) {
      showToast(`Imported sheet with ${rows.length} rows`);
      State.sheets.push(result.sheet);
      State.activeSheetId = result.sheet.id;
      localStorage.setItem('emittr_active_sheet_id', result.sheet.id);
      renderSheetSelector();
      renderActiveSheet();
      triggerHaptic(12);
    } else {
      showToast(result.msg || 'Import failed');
    }
  } catch (e) {
    showToast('Failed to parse sheet file');
  } finally {
    event.target.value = '';
  }
}


// ── Temporary Cheat Sheet Controller (Session-Only, Touch-First) ────────────

const DEFAULT_CHEAT_SAMPLE = {
  columns: ['Sample Name', 'DOB', 'Phone', 'ID', 'Email'],
  rows: [
    ['Rahul Sharma', '15/03/2002', '9876543210', 'ID1001', 'rahul.sharma@example.com'],
    ['Priya Reddy', '22/07/2003', '9876501234', 'ID1002', 'priya.reddy@example.com'],
    ['Arjun Kumar', '10/11/2001', '9123456780', 'ID1003', 'arjun.kumar@example.com'],
    ['Sneha Patel', '05/02/2004', '9988776655', 'ID1004', 'sneha.patel@example.com'],
    ['Kiran Rao', '18/09/2002', '9012345678', 'ID1005', 'kiran.rao@example.com'],
    ['Ananya Verma', '27/12/2003', '9098765432', 'ID1006', 'ananya.verma@example.com'],
    ['Vikram Singh', '14/06/2001', '9345678120', 'ID1007', 'vikram.singh@example.com'],
    ['Divya Nair', '30/01/2004', '9567812340', 'ID1008', 'divya.nair@example.com']
  ]
};

function switchSheetTab(tab) {
  const btnCheat = document.getElementById('btn-seg-cheatsheet');
  const btnSaved = document.getElementById('btn-seg-savedsheets');
  const subCheat = document.getElementById('subview-cheatsheet');
  const subSaved = document.getElementById('subview-savedsheets');

  if (tab === 'cheatsheet') {
    btnCheat?.classList.add('active');
    btnSaved?.classList.remove('active');
    if (subCheat) subCheat.style.display = 'block';
    if (subSaved) subSaved.style.display = 'none';
  } else {
    btnSaved?.classList.add('active');
    btnCheat?.classList.remove('active');
    if (subSaved) subSaved.style.display = 'block';
    if (subCheat) subCheat.style.display = 'none';
  }
  triggerHaptic(8);
}

function renderCheatSheet() {
  const table = document.getElementById('cheat-sheet-table');
  if (!table) return;

  if (!State.tempCheatSheet) {
    State.tempCheatSheet = JSON.parse(JSON.stringify(DEFAULT_CHEAT_SAMPLE));
  }

  const columns = State.tempCheatSheet.columns || [];
  const rows = State.tempCheatSheet.rows || [];

  if (columns.length === 0 || rows.length === 0) {
    table.innerHTML = `
      <tr>
        <td style="padding:32px;text-align:center;color:var(--md-sys-color-outline);">
          No cheat sheet data loaded. Click <strong>Import CSV</strong>, <strong>Paste Table</strong>, or <strong>Sample Data</strong> above.
        </td>
      </tr>
    `;
    return;
  }

  const filterQuery = (document.getElementById('cheat-filter-input')?.value || '').toLowerCase().trim();

  let thead = '<thead><tr>';
  thead += '<th style="width:72px;min-width:72px;text-align:center;">Row Fill</th>';
  columns.forEach((col, idx) => {
    const isFirst = (idx === 0);
    thead += `<th class="${isFirst ? 'col-sticky-left' : ''}">${escapeHtml(col)}</th>`;
  });
  thead += '</tr></thead>';

  let tbody = '<tbody>';
  let visibleCount = 0;

  rows.forEach((row, rIdx) => {
    if (filterQuery) {
      const rowText = row.join(' ').toLowerCase();
      if (!rowText.includes(filterQuery)) return;
    }
    visibleCount++;

    tbody += `<tr>`;
    tbody += `
      <td style="text-align:center;padding:4px 6px;">
        <button type="button" class="sheet-row-btn" onclick="typeCheatSheetRow(${rIdx})" title="Type all cells in this row sequentially">
          <span>▶ ${rIdx + 1}</span>
        </button>
      </td>
    `;

    columns.forEach((col, cIdx) => {
      const val = row[cIdx] || '';
      const isFirst = (cIdx === 0);
      const isLastSent = (State.cheatLastSent?.r === rIdx && State.cheatLastSent?.c === cIdx);
      const displayVal = val ? escapeHtml(val) : '<span class="sheet-cell-empty">(empty)</span>';

      tbody += `
        <td class="${isFirst ? 'col-sticky-left' : ''}">
          <button type="button" class="cheat-sheet-cell-btn ${isLastSent ? 'last-sent' : ''}" id="cheat-cell-btn-${rIdx}-${cIdx}" onclick="typeCheatSheetCell(this, ${rIdx}, ${cIdx})" title="Tap to auto-type: ${escapeHtml(val)}">
            <span>${displayVal}</span>
          </button>
        </td>
      `;
    });
    tbody += `</tr>`;
  });

  if (visibleCount === 0) {
    tbody += `<tr><td colspan="${columns.length + 1}" style="padding:28px;text-align:center;color:var(--md-sys-color-outline);">No rows match "${escapeHtml(filterQuery)}"</td></tr>`;
  }
  tbody += '</tbody>';

  table.innerHTML = thead + tbody;
}

async function typeCheatSheetCell(btn, rIdx, cIdx) {
  if (!State.tempCheatSheet || !State.tempCheatSheet.rows || !State.tempCheatSheet.rows[rIdx]) return;

  const rawVal = State.tempCheatSheet.rows[rIdx][cIdx] || '';
  const action = document.getElementById('cheat-cell-action-select')?.value || 'tab';

  let textToSend = rawVal;
  if (action === 'tab') {
    textToSend += '\t';
  } else if (action === 'enter') {
    textToSend += '\n';
  }

  if (btn) {
    btn.classList.add('active-pulse');
    setTimeout(() => btn.classList.remove('active-pulse'), 250);
  }
  document.querySelectorAll('.cheat-sheet-cell-btn.last-sent').forEach(b => b.classList.remove('last-sent'));
  if (btn) btn.classList.add('last-sent');
  State.cheatLastSent = { r: rIdx, c: cIdx };

  triggerHaptic(18);
  const colName = State.tempCheatSheet.columns[cIdx] || `Col ${cIdx + 1}`;
  const actionLabel = action === 'tab' ? ' [Tab ⇥]' : (action === 'enter' ? ' [Enter ↵]' : '');
  showToast(`Typing ${colName}: "${rawVal}"${actionLabel}`);
  setTypingUI(true, textToSend.length);

  try {
    const res = await fetch('/api/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToSend,
        delay_ms: State.delayMs,
        initial_delay_s: 0
      })
    });
    const result = await res.json();
    if (!result.ok) {
      setTypingUI(false);
      showToast(result.msg || 'Typing failed');
    }
  } catch (e) {
    setTypingUI(false);
    showToast('Failed to reach server');
  }
}

async function typeCheatSheetRow(rIdx) {
  if (!State.tempCheatSheet || !State.tempCheatSheet.rows || !State.tempCheatSheet.rows[rIdx]) return;

  const row = State.tempCheatSheet.rows[rIdx];
  const action = document.getElementById('cheat-cell-action-select')?.value || 'tab';

  let textToSend = row.join('\t');
  if (action === 'enter') {
    textToSend += '\n';
  } else if (action === 'tab') {
    textToSend += '\t';
  }

  triggerHaptic(25);
  showToast(`Typing row #${rIdx + 1} (${row.length} fields)`);
  setTypingUI(true, textToSend.length);

  try {
    const res = await fetch('/api/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToSend,
        delay_ms: State.delayMs,
        initial_delay_s: 0
      })
    });
    const result = await res.json();
    if (!result.ok) {
      setTypingUI(false);
      showToast(result.msg || 'Typing row failed');
    }
  } catch (e) {
    setTypingUI(false);
    showToast('Failed to reach server');
  }
}

function filterCheatSheet() {
  renderCheatSheet();
}

function triggerImportCheatSheet() {
  const fileInput = document.getElementById('cheat-file-input');
  if (fileInput) fileInput.click();
}

async function handleCheatFileInput(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    parseAndLoadCheatSheetText(text, file.name);
  } catch (e) {
    showToast('Failed to read file');
  } finally {
    event.target.value = '';
  }
}

function openPasteCheatSheetModal() {
  const textarea = document.getElementById('paste-cheatsheet-textarea');
  if (textarea) textarea.value = '';
  document.getElementById('paste-cheatsheet-modal').classList.add('open');
  triggerHaptic(10);
  setTimeout(() => textarea?.focus(), 120);
}

function closePasteCheatSheetModal(e) {
  if (e && e.target !== document.getElementById('paste-cheatsheet-modal') && !e.target.classList.contains('close-modal-btn')) {
    return;
  }
  document.getElementById('paste-cheatsheet-modal').classList.remove('open');
  triggerHaptic(8);
}

function loadPastedCheatSheet() {
  const text = (document.getElementById('paste-cheatsheet-textarea')?.value || '').trim();
  if (!text) {
    showToast('Please paste table content from Excel or CSV');
    return;
  }
  parseAndLoadCheatSheetText(text, 'Pasted Data');
  document.getElementById('paste-cheatsheet-modal').classList.remove('open');
}

function parseAndLoadCheatSheetText(rawText, sourceLabel) {
  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    showToast('Data must have at least 1 header line and 1 data row');
    return;
  }

  const isTab = lines[0].includes('\t');
  const delimiter = isTab ? '\t' : ',';

  const parseRow = (line) => {
    if (delimiter === '\t') {
      return line.split('\t').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
    }
    const res = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        res.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    res.push(cur.trim());
    return res;
  };

  const headers = parseRow(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    if (row.length === 0 || row.every(c => c === '')) continue;
    while (row.length < headers.length) row.push('');
    rows.push(row.slice(0, headers.length));
  }

  if (rows.length === 0) {
    showToast('No data rows found');
    return;
  }

  State.tempCheatSheet = { columns: headers, rows };
  renderCheatSheet();
  showToast(`Loaded ${rows.length} rows into temporary cheat sheet`);
  triggerHaptic(14);
}

function resetCheatSheetToSample() {
  State.tempCheatSheet = JSON.parse(JSON.stringify(DEFAULT_CHEAT_SAMPLE));
  renderCheatSheet();
  showToast('Reset to sample dataset (8 rows)');
  triggerHaptic(10);
}

function clearCheatSheet() {
  if (confirm('Clear temporary cheat sheet? (Refreshing also resets this)')) {
    State.tempCheatSheet = { columns: [], rows: [] };
    renderCheatSheet();
    showToast('Temporary cheat sheet cleared');
    triggerHaptic(8);
  }
}

