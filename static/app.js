/* ── Emittr  ·  Client-side Application Logic  ·  v1.2.0 ─────────────────── */

'use strict';

const APP_VERSION = '1.2.0';

const State = {
  connected: false,
  isTyping:  false,
  delayMs:   15,
  ws:        null,
  reconnectTimer: null,
  // Feature 3: sensitivity (1.0 = default, range 0.5–2.0)
  sensitivity: 1.0,
  config: {
    autoclear:   true,
    haptic:      true,
    countdown:   0,
    autoenter:   false,
    theme:       'dark',
    sensitivity: 15    // raw slider value (5–30), maps to 0.5×–2.0×
  }
};

// ── Initialization ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  initWebSocket();
  initTextareaCounter();
  initLiveKeyboard();
  initScrollWheels();
  initTrackpad();
  fetchInitialStatus();
});

// ── Config Management ─────────────────────────────────────────────────────────

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

  // Delay
  const savedDelay = localStorage.getItem('emittr_delay');
  if (savedDelay) {
    const d = parseInt(savedDelay, 10);
    if (!isNaN(d)) {
      State.delayMs = d;
      document.getElementById('delay-slider').value  = d;
      document.getElementById('delay-val').innerText = `${d} ms / char`;
      updatePresetPills(d);
    }
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

// ── WebSocket & Status ────────────────────────────────────────────────────────

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
  if (msg.type === 'status' || msg.type === 'connection_change') {
    updateConnectionUI(msg.data);
  } else if (msg.type === 'typing_start') {
    setTypingUI(true, msg.total);
  } else if (msg.type === 'typing_end') {
    setTypingUI(false);
    if (msg.aborted) {
      showToast('Typing aborted');
    } else {
      showToast(`Typed ${msg.typed} characters`);
      if (State.config.autoclear) {
        document.getElementById('text-input').value = '';
        updateCharCount();
      }
    }
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
    text.innerText  = `Connected (${data.speed || 'USB'})`;
  } else {
    badge.className = 'connection-badge disconnected';
    text.innerText  = 'PC Not Connected';
  }

  const udc   = document.getElementById('hw-udc');
  const speed = document.getElementById('hw-speed');
  const node  = document.getElementById('hw-node');
  if (udc)   udc.innerText   = data.udc   || 'hisi-usb-otg';
  if (speed) speed.innerText = data.speed || 'N/A';
  if (node)  node.innerText  = data.hid_node || data.kbd_node || '/dev/hidg0';
}

// ── View Switching ────────────────────────────────────────────────────────────

function switchView(viewName, clickedBtn) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b  => b.classList.remove('active'));
  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) targetPanel.classList.add('active');
  if (clickedBtn)  clickedBtn.classList.add('active');
  triggerHaptic(12);
  if (viewName === 'live') setTimeout(focusLiveInput, 150);
}

// ── View 1: Typer ─────────────────────────────────────────────────────────────

function initTextareaCounter() {
  document.getElementById('text-input').addEventListener('input', updateCharCount);
}

function updateCharCount() {
  document.getElementById('char-count').innerText =
    `${document.getElementById('text-input').value.length} chars`;
}

function selectPreset(btn, delay) {
  document.querySelectorAll('.speed-presets .preset-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  State.delayMs = delay;
  document.getElementById('delay-slider').value  = delay;
  document.getElementById('delay-val').innerText = `${delay} ms / char`;
  localStorage.setItem('emittr_delay', delay);
  triggerHaptic(8);
}

function onSliderChange(val) {
  State.delayMs = parseInt(val, 10);
  document.getElementById('delay-val').innerText = `${val} ms / char`;
  localStorage.setItem('emittr_delay', val);
  updatePresetPills(State.delayMs);
}

function updatePresetPills(val) {
  document.querySelectorAll('.speed-presets .preset-pill').forEach(pill => {
    pill.classList.toggle('active', parseInt(pill.dataset.delay, 10) === val);
  });
}

function clearText() {
  const ta = document.getElementById('text-input');
  ta.value = ''; updateCharCount(); ta.focus(); triggerHaptic(8);
}

async function sendText() {
  let text = document.getElementById('text-input').value;
  if (!text) { showToast('Please enter some text'); return; }
  if (State.config.autoenter) text += '\n';
  triggerHaptic(15);
  setTypingUI(true, text.length);
  try {
    const res    = await fetch('/api/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, delay_ms: State.delayMs, initial_delay_s: State.config.countdown })
    });
    const result = await res.json();
    if (!result.ok) { setTypingUI(false); showToast(result.msg || 'Typing failed'); }
  } catch (e) { setTypingUI(false); showToast('Failed to connect to server'); }
}

async function stopTyping() {
  triggerHaptic(20);
  try { await fetch('/api/stop', { method: 'POST' }); } catch (e) {}
}

function setTypingUI(isTyping, totalChars = 0) {
  State.isTyping = isTyping;
  document.getElementById('btn-send').style.display    = isTyping ? 'none' : 'flex';
  document.getElementById('btn-stop').style.display    = isTyping ? 'flex' : 'none';
  document.getElementById('progress-wrapper').style.display = isTyping ? 'block' : 'none';
  if (isTyping) {
    document.getElementById('progress-text').innerText =
      `Typing ${totalChars} characters (${State.delayMs}ms/char)...`;
    animateProgressBar(totalChars * State.delayMs);
  } else {
    document.getElementById('progress-fill').style.width = '0%';
  }
}

function animateProgressBar(totalTimeMs) {
  const fill = document.getElementById('progress-fill');
  fill.style.transition = `width ${totalTimeMs / 1000.0}s linear`;
  setTimeout(() => { if (State.isTyping) fill.style.width = '100%'; }, 20);
}

// ── View 2: Live Keyboard ─────────────────────────────────────────────────────

// Feature 4: collapsible key-feed
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
      emitChar(e.key); e.preventDefault();
    }
  });

  input.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'insertLineBreak') { emitChar('Enter'); e.preventDefault(); }
    else if (e.inputType === 'deleteContentBackward') { emitChar('Backspace'); }
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
    if (cur.length > 25) { input.value = ''; lastValue = ''; }
    else { resetTimer = setTimeout(() => { input.value = ''; lastValue = ''; }, 1500); }
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
      body:    JSON.stringify({ key: ch })
    });
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

// ── View 3: Shortcuts ─────────────────────────────────────────────────────────

async function sendCombo(combo) {
  triggerHaptic(15);
  showToast(`Injected ${combo.toUpperCase()}`);
  try {
    await fetch('/api/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ combo })
    });
  } catch (e) {}
}

// ── View 4: Scroll Wheels (Feature 1) ────────────────────────────────────────

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
  let accum   = 0;          // accumulated fractional ticks
  const TICK_PX = 18;       // pixels per one scroll notch

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

    // Emit a scroll tick for each TICK_PX travelled
    while (Math.abs(accum) >= TICK_PX) {
      const dir = accum > 0 ? 1 : -1;
      accum    -= dir * TICK_PX;
      // Wheel scrolls: vertical = up/down, horizontal = left/right
      // wheel > 0 = scroll down, wheel < 0 = scroll up (standard HID)
      const scrollVal = Math.round(dir * 2 * State.sensitivity);
      emitScroll(axis, scrollVal);
      animateWheelNotch(drum, axis, dir);
      triggerHaptic(4);
    }
  }

  function onEnd(e) {
    isDown = false;
    accum  = 0;
  }

  // Touch events
  wheel.addEventListener('touchstart', onStart, { passive: false });
  wheel.addEventListener('touchmove',  onMove,  { passive: false });
  wheel.addEventListener('touchend',   onEnd,   { passive: false });

  // Mouse events (desktop fallback)
  wheel.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', (e) => { if (isDown) onMove(e); });
  window.addEventListener('mouseup',   (e) => { if (isDown) onEnd(e); });
}

function emitScroll(axis, val) {
  // axis 'v' -> vertical wheel, 'h' -> horizontal (map to wheel field)
  // Server supports "wheel" in mouse_move for vertical scroll.
  // For horizontal, we send dx instead (mouse horizontal scroll via dx trick).
  if (!State.ws || State.ws.readyState !== WebSocket.OPEN) return;
  if (axis === 'v') {
    State.ws.send(JSON.stringify({ action: 'mouse_move', dx: 0, dy: 0, wheel: val }));
  } else {
    // Horizontal scroll: send as small horizontal mouse delta so the OS interprets it
    State.ws.send(JSON.stringify({ action: 'mouse_move', dx: val * 6, dy: 0, wheel: 0 }));
  }
}

function animateWheelNotch(drum, axis, dir) {
  // Remove existing animation class, force reflow, then re-add
  drum.classList.remove('wheel-notch-v', 'wheel-notch-h');
  void drum.offsetWidth;  // reflow
  if (axis === 'v') {
    drum.style.setProperty('--notch-dy', `${-dir * 7}px`);
    drum.classList.add('wheel-notch-v');
  } else {
    drum.style.setProperty('--notch-dx', `${-dir * 7}px`);
    drum.classList.add('wheel-notch-h');
  }
}

// ── View 4: Trackpad ──────────────────────────────────────────────────────────

function initTrackpad() {
  const surface = document.getElementById('touchpad-surface');
  if (!surface) return;

  let lastX = 0, lastY = 0, startX = 0, startY = 0;
  let isMoving = false, tapStartTime = 0;

  // ── Touch (single-finger move, two-finger scroll) ──
  surface.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      lastX = startX = e.touches[0].clientX;
      lastY = startY = e.touches[0].clientY;
      isMoving     = true;
      tapStartTime = Date.now();
    } else if (e.touches.length === 2) {
      lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    }
  }, { passive: false });

  surface.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dy   = Math.round((midY - lastY) * 0.3 * State.sensitivity);
      lastY = midY;
      lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      if (dy !== 0 && State.ws && State.ws.readyState === WebSocket.OPEN) {
        State.ws.send(JSON.stringify({ action: 'mouse_move', dx: 0, dy: 0, wheel: -dy }));
      }
      return;
    }
    if (!isMoving || e.touches.length !== 1) return;
    const curX = e.touches[0].clientX, curY = e.touches[0].clientY;
    const dx   = Math.round((curX - lastX) * 1.5 * State.sensitivity);
    const dy   = Math.round((curY - lastY) * 1.5 * State.sensitivity);
    lastX = curX; lastY = curY;
    if ((dx || dy) && State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_move', dx, dy, wheel: 0 }));
    }
  }, { passive: false });

  surface.addEventListener('touchend', (e) => {
    e.preventDefault();
    isMoving = false;
    if (Date.now() - tapStartTime < 220 && Math.hypot(lastX - startX, lastY - startY) < 8) {
      onMouseClick(1);
    }
  }, { passive: false });

  // ── Mouse fallback ──
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

  // Desktop scroll wheel on touchpad surface
  surface.addEventListener('wheel', (e) => {
    e.preventDefault();
    const w = Math.sign(e.deltaY) * Math.min(Math.abs(Math.round(e.deltaY * State.sensitivity / 10)), 5);
    if (w && State.ws && State.ws.readyState === WebSocket.OPEN) {
      State.ws.send(JSON.stringify({ action: 'mouse_move', dx: 0, dy: 0, wheel: w }));
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
      body:    JSON.stringify({ buttons: buttonNum })
    });
  }
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function openSettings()  {
  document.getElementById('settings-modal').classList.add('open');
  triggerHaptic(8); fetchInitialStatus();
}

function closeSettings(e) {
  if (e && e.target !== document.getElementById('settings-modal')) return;
  document.getElementById('settings-modal').classList.remove('open');
  triggerHaptic(8);
}

// ── Toast Utility ─────────────────────────────────────────────────────────────

let _toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}
