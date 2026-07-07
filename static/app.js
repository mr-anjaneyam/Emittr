/**
 * Emittr · Web App Controller v1.2.1
 * Provides touch gliding, two-finger gesture scrolling, physical drum scroll wheels,
 * IME keyboard mirror, Windows shortcuts deck, and emergency key unstick.
 */

'use strict';

const APP_VERSION = '1.2.1';

const State = {
  ws: null,
  reconnectTimer: null,
  connected: false,
  isTyping: false,
  delayMs: 15,
  sensitivity: 1.0,
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
  loadConfig();
  initVersionBadge();
  initWebSocket();
  initTextareaCounter();
  initLiveKeyboard();
  initScrollWheels();
  initTrackpad();
  fetchInitialStatus();
});

// ── Version Badge Initialization ───────────────────────────────────────────

function initVersionBadge(ver) {
  const v = ver || APP_VERSION;
  document.querySelectorAll('.version-badge').forEach(el => {
    el.textContent = v.startsWith('v') ? v : 'v' + v;
  });
  const hwVer = document.getElementById('hw-ver');
  if (hwVer) hwVer.textContent = v.startsWith('v') ? v : 'v' + v;
}

// ── Config Management ───────────────────────────────────────────────────────

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
  document.getElementById('sensitivity-val').innerText = ${State.sensitivity.toFixed(1)}×;

  // Delay
  const savedDelay = localStorage.getItem('emittr_delay');
  if (savedDelay) {
    const d = parseInt(savedDelay, 10);
    if (!isNaN(d)) {
      State.delayMs = d;
      document.getElementById('delay-slider').value  = d;
      document.getElementById('delay-val').innerText = ${d} ms / char;
      updatePresetPills(d);
    }
  }

  // Dashboard mode preference on desktop
  const isDash = localStorage.getItem('emittr_dashboard') === 'true';
  if (isDash && window.innerWidth >= 900) {
    document.body.classList.add('dashboard-mode');
    const btn = document.getElementById('btn-dashboard-mode');
    if (btn) btn.classList.add('active');
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
  document.getElementById('sensitivity-val').innerText = ${State.sensitivity.toFixed(1)}×;
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

// ── Emergency Unstick Keys ──────────────────────────────────────────────────

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

// ── Dashboard Mode (PC / Wide Screens) ───────────────────────────────────────

function toggleDashboardMode() {
  const active = document.body.classList.toggle('dashboard-mode');
  const btn = document.getElementById('btn-dashboard-mode');
  if (btn) btn.classList.toggle('active', active);
  localStorage.setItem('emittr_dashboard', String(active));
  triggerHaptic(12);
  showToast(active ? 'Dashboard mode: multi-panel view active' : 'Standard tab view active');
}

// ── WebSocket & Status ──────────────────────────────────────────────────────

function initWebSocket() {
  if (State.reconnectTimer) { clearTimeout(State.reconnectTimer); State.reconnectTimer = null; }
  if (State.ws && (State.ws.readyState === WebSocket.CONNECTING ||
                   State.ws.readyState === WebSocket.OPEN)) return;

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  State.ws = new WebSocket(${protocol}///ws);

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
  if (msg.type === 'status' || msg.type === 'connection_change') {
    updateConnectionUI(msg.data);
  } else if (msg.type === 'typing_start') {
    setTypingUI(true, msg.total);
  } else if (msg.type === 'typing_end') {
    setTypingUI(false);
    if (msg.aborted) {
      showToast('Typing aborted');
    } else {
      showToast(Finished typing text);
      if (State.config.autoclear) {
        document.getElementById('text-input').value = '';
        updateCharCount();
      }
    }
  } else if (msg.type === 'countdown') {
    showToast(Typing starts in s...);
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
  const badge = document.getElementById('usb-badge');
  const text  = document.getElementById('usb-status-text');
  State.connected = data.connected;

  if (data.connected) {
    badge.className = 'connection-badge connected';
    text.innerText  = Connected ();
  } else {
    badge.className = 'connection-badge disconnected';
    text.innerText  = 'PC Not Connected';
  }

  const udc   = document.getElementById('hw-udc');
  const speed = document.getElementById('hw-speed');
  const node  = document.getElementById('hw-node');
  if (udc)   udc.innerText   = data.udc   || 'hisi-usb-otg';
  if (speed) speed.innerText = data.speed || 'N/A';
  if (node)  node.innerText  = data.hid_node || '/dev/hidg0';

  if (data.version) {
    initVersionBadge(data.version);
  }
}

// ── View Switching ──────────────────────────────────────────────────────────

function switchView(viewName, clickedBtn) {
  if (document.body.classList.contains('dashboard-mode')) {
    document.body.classList.remove('dashboard-mode');
    const dBtn = document.getElementById('btn-dashboard-mode');
    if (dBtn) dBtn.classList.remove('active');
    localStorage.setItem('emittr_dashboard', 'false');
  }

  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.desktop-nav-btn').forEach(b => {
    if (b.dataset.view) b.classList.toggle('active', b.dataset.view === viewName);
  });

  const targetPanel = document.getElementById(iew-);
  if (targetPanel) targetPanel.classList.add('active');

  const bottomNavBtn = document.getElementById(
av-);
  if (bottomNavBtn) bottomNavBtn.classList.add('active');

  triggerHaptic(12);
  if (viewName === 'live') setTimeout(focusLiveInput, 150);
}

// ── View 1: Typer ───────────────────────────────────────────────────────────

function initTextareaCounter() {
  document.getElementById('text-input').addEventListener('input', updateCharCount);
}

function updateCharCount() {
  document.getElementById('char-count').innerText =
    ${document.getElementById('text-input').value.length} chars;
}

function selectPreset(btn, delay) {
  document.querySelectorAll('.preset-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  State.delayMs = delay;
  document.getElementById('delay-slider').value  = delay;
  document.getElementById('delay-val').innerText = ${delay} ms / char;
  localStorage.setItem('emittr_delay', delay);
  triggerHaptic(8);
}

function onSliderChange(val) {
  const d = parseInt(val, 10);
  State.delayMs = d;
  document.getElementById('delay-val').innerText = ${d} ms / char;
  updatePresetPills(d);
  localStorage.setItem('emittr_delay', d);
}

function updatePresetPills(val) {
  document.querySelectorAll('.preset-pill').forEach(p => {
    p.classList.toggle('active', parseInt(p.dataset.delay, 10) === val);
  });
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
    fill.style.transition = width ms linear;
    fill.style.width      = '100%';
  });
}

// ── View 2: Live Keyboard ───────────────────────────────────────────────────

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
    hint.innerText = '🟢 Keyboard active — type now';
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

// ── View 3: Shortcuts ───────────────────────────────────────────────────────

async function sendCombo(combo) {
  triggerHaptic(15);
  showToast(Injected );
  try {
    await fetch('/api/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ combo })
    });
  } catch (e) {}
}

// ── View 4: Dual Bottom Scroll Wheels (Side-by-Side) ────────────────────────

function initScrollWheels() {
  initOneWheel('vwheel', 'v');
  initOneWheel('hwheel', 'h');
}

function initOneWheel(wheelId, axis) {
  const wheel = document.getElementById(wheelId);
  if (!wheel) return;
  const drum = wheel.querySelector('.wheel-drum');
  let lastPos = 0;
  let isDown  = false;
  let accum   = 0;
  const TICK_PX = 14; // pixels travelled per notch

  function getPos(e) {
    const t = e.touches ? e.touches[0] : e;
    return axis === 'v' ? t.clientY : t.clientX;
  }

  function onStart(e) {
    e.preventDefault();
    lastPos = getPos(e);
    isDown  = true;
    accum   = 0;
    wheel.classList.add('clicking');
    setTimeout(() => wheel.classList.remove('clicking'), 120);
  }

  function onMove(e) {
    if (!isDown) return;
    e.preventDefault();
    const pos   = getPos(e);
    const delta = pos - lastPos;
    lastPos     = pos;
    accum      += delta;

    while (Math.abs(accum) >= TICK_PX) {
      const dir = accum > 0 ? 1 : -1;
      accum    -= dir * TICK_PX;

      if (axis === 'v') {
        // Vertical wheel: drag down (dir > 0) -> negative wheel delta (scroll down)
        // Drag up (dir < 0) -> positive wheel delta (scroll up)
        const scrollVal = -Math.round(dir * 2 * State.sensitivity);
        emitScroll('v', scrollVal);
        animateWheelNotch(drum, 'v', dir);
      } else {
        // Horizontal wheel: drag right (dir > 0) -> positive horizontal scroll (scroll right)
        // Drag left (dir < 0) -> negative horizontal scroll (scroll left)
        const scrollVal = Math.round(dir * 2 * State.sensitivity);
        emitScroll('h', scrollVal);
        animateWheelNotch(drum, 'h', dir);
      }

      triggerHaptic(4);
    }
  }

  function onEnd(e) {
    isDown = false;
    accum  = 0;
  }

  // Touch
  wheel.addEventListener('touchstart', onStart, { passive: false });
  wheel.addEventListener('touchmove',  onMove,  { passive: false });
  wheel.addEventListener('touchend',   onEnd,   { passive: false });

  // Mouse fallback
  wheel.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', (e) => { if (isDown) onMove(e); });
  window.addEventListener('mouseup',   (e) => { if (isDown) onEnd(e); });
}

function emitScroll(axis, val) {
  if (val === 0) return;

  if (axis === 'v') {
    // Vertical scroll (standard mouse wheel)
    if (State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_scroll', wheel_v: val, wheel_h: 0 }));
    } else {
      fetch('/api/mouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wheel: val })
      }).catch(() => {});
    }
  } else {
    // Horizontal scroll (Shift + Wheel)
    if (State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_scroll', wheel_v: 0, wheel_h: val }));
    } else {
      fetch('/api/mouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wheel_h: val })
      }).catch(() => {});
    }
  }
}

function animateWheelNotch(drum, axis, dir) {
  drum.classList.remove('wheel-notch-v', 'wheel-notch-h');
  void drum.offsetWidth; // Force reflow
  if (axis === 'v') {
    drum.style.setProperty('--notch-dy', ${-dir * 6}px);
    drum.classList.add('wheel-notch-v');
  } else {
    drum.style.setProperty('--notch-dx', ${-dir * 6}px);
    drum.classList.add('wheel-notch-h');
  }
}

// ── View 4: Touchpad & Two-Finger Gesture Engine ─────────────────────────────

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

    // ── Two-Finger Touchpad Scrolling (Vertical + Horizontal) ──
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

    // ── Single-Finger Cursor Movement ──
    if (!isMoving || e.touches.length !== 1 || isTwoFinger) return;
    const curX = e.touches[0].clientX, curY = e.touches[0].clientY;
    const dx   = Math.round((curX - lastX) * 1.5 * State.sensitivity);
    const dy   = Math.round((curY - lastY) * 1.5 * State.sensitivity);
    lastX = curX; lastY = curY;

    if ((dx || dy) && State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_move', dx, dy, wheel: 0 }));
    }
  }, { passive: false });

  // Touchend
  surface.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (isTwoFinger) {
      if (e.touches.length === 0) isTwoFinger = false;
      return;
    }

    isMoving = false;
    const duration  = Date.now() - tapStartTime;
    const totalDist = Math.hypot(lastX - startX, lastY - startY);
    if (duration < 220 && totalDist < 8) {
      onMouseClick(1);
    }
  }, { passive: false });

  // ── Desktop Mouse Fallback ──
  let isMouseDown = false;
  surface.addEventListener('mousedown', (e) => {
    lastX = startX = e.clientX; lastY = startY = e.clientY;
    isMouseDown = true; tapStartTime = Date.now();
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
  window.addEventListener('mouseup', () => {
    if (!isMouseDown) return;
    isMouseDown = false;
    if (Date.now() - tapStartTime < 220 && Math.hypot(lastX - startX, lastY - startY) < 8) {
      onMouseClick(1);
    }
  });

  // ── Desktop Wheel on Touchpad Surface (handles with/without Shift key) ──
  surface.addEventListener('wheel', (e) => {
    e.preventDefault();
    const isShift = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);

    if (isShift) {
      // Horizontal scroll
      const delta = e.deltaX || e.deltaY;
      const w = Math.sign(delta) * Math.min(Math.abs(Math.round(delta * State.sensitivity / 12)), 6);
      emitScroll('h', w);
    } else {
      // Vertical scroll: deltaY > 0 is scroll down (send negative wheel)
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

// ── Preferences Modal ───────────────────────────────────────────────────────

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

// ── Toast Utility ───────────────────────────────────────────────────────────

let _toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
