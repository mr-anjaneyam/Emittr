/* ── USB Typer Client-side Application Logic ────────────────────────── */

'use strict';

const State = {
  connected: false,
  isTyping: false,
  delayMs: 15,
  ws: null,
  reconnectTimer: null,
  config: {
    autoclear: true,
    haptic: true,
    countdown: 0,
    autoenter: false,
    theme: 'dark'
  }
};

// ── Initialization ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  initWebSocket();
  initTextareaCounter();
  initLiveKeyboard();
  initTrackpad();
  fetchInitialStatus();
});

// ── Config Management ─────────────────────────────────────────────────────────

function loadConfig() {
  const saved = localStorage.getItem('usb_typer_cfg');
  if (saved) {
    try {
      State.config = Object.assign(State.config, JSON.parse(saved));
    } catch (e) {}
  }
  document.getElementById('cfg-autoclear').checked = State.config.autoclear;
  document.getElementById('cfg-haptic').checked = State.config.haptic;
  document.getElementById('cfg-countdown').value = State.config.countdown;
  document.getElementById('cfg-autoenter').checked = State.config.autoenter;
  document.getElementById('cfg-theme').checked = State.config.theme !== 'light';
  applyTheme(State.config.theme);

  const savedDelay = localStorage.getItem('usb_typer_delay');
  if (savedDelay) {
    const d = parseInt(savedDelay, 10);
    if (!isNaN(d)) {
      State.delayMs = d;
      document.getElementById('delay-slider').value = d;
      document.getElementById('delay-val').innerText = `${d} ms / char`;
      updatePresetPills(d);
    }
  }
}

function saveConfig() {
  State.config.autoclear = document.getElementById('cfg-autoclear').checked;
  State.config.haptic = document.getElementById('cfg-haptic').checked;
  State.config.countdown = parseInt(document.getElementById('cfg-countdown').value, 10) || 0;
  State.config.autoenter = document.getElementById('cfg-autoenter').checked;
  localStorage.setItem('usb_typer_cfg', JSON.stringify(State.config));
}

function toggleTheme() {
  const isDark = document.getElementById('cfg-theme').checked;
  State.config.theme = isDark ? 'dark' : 'light';
  applyTheme(State.config.theme);
  saveConfig();
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}

function triggerHaptic(duration = 10) {
  if (State.config.haptic && navigator.vibrate) {
    try { navigator.vibrate(duration); } catch (e) {}
  }
}

// ── WebSocket & Status Connection ─────────────────────────────────────────────

function initWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${location.host}/ws`;

  State.ws = new WebSocket(url);

  State.ws.onopen = () => {
    if (State.reconnectTimer) {
      clearInterval(State.reconnectTimer);
      State.reconnectTimer = null;
    }
  };

  State.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    } catch (e) {}
  };

  State.ws.onclose = () => {
    if (!State.reconnectTimer) {
      State.reconnectTimer = setInterval(initWebSocket, 2000);
    }
  };

  State.ws.onerror = () => {
    try { State.ws.close(); } catch (e) {}
  };
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
    const res = await fetch('/api/status');
    const data = await res.json();
    updateConnectionUI(data);
  } catch (e) {}
}

function updateConnectionUI(data) {
  if (!data) return;
  const badge = document.getElementById('usb-badge');
  const text = document.getElementById('usb-status-text');

  State.connected = data.connected;

  if (data.connected) {
    badge.className = 'connection-badge connected';
    text.innerText = `Connected (${data.speed || 'USB'})`;
  } else {
    badge.className = 'connection-badge disconnected';
    text.innerText = 'PC Not Connected';
  }

  // Update hardware sheet details
  const udc = document.getElementById('hw-udc');
  const speed = document.getElementById('hw-speed');
  const node = document.getElementById('hw-node');
  if (udc) udc.innerText = data.udc || data.udc_state || 'hisi-usb-otg';
  if (speed) speed.innerText = data.speed || 'N/A';
  if (node) node.innerText = data.kbd_node || '/dev/hidg0';
}

// ── View Switching ────────────────────────────────────────────────────────────

function switchView(viewName, clickedBtn) {
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) targetPanel.classList.add('active');
  if (clickedBtn) clickedBtn.classList.add('active');

  triggerHaptic(12);

  // If opening live view, hint focus
  if (viewName === 'live') {
    setTimeout(focusLiveInput, 150);
  }
}

// ── View 1: Typer (Send text with customized delay) ───────────────────────────

function initTextareaCounter() {
  const ta = document.getElementById('text-input');
  ta.addEventListener('input', updateCharCount);
}

function updateCharCount() {
  const ta = document.getElementById('text-input');
  document.getElementById('char-count').innerText = `${ta.value.length} chars`;
}

function selectPreset(btn, delay) {
  document.querySelectorAll('.speed-presets .preset-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  State.delayMs = delay;
  document.getElementById('delay-slider').value = delay;
  document.getElementById('delay-val').innerText = `${delay} ms / char`;
  localStorage.setItem('usb_typer_delay', delay);
  triggerHaptic(8);
}

function onSliderChange(val) {
  State.delayMs = parseInt(val, 10);
  document.getElementById('delay-val').innerText = `${val} ms / char`;
  localStorage.setItem('usb_typer_delay', val);
  updatePresetPills(State.delayMs);
}

function updatePresetPills(val) {
  document.querySelectorAll('.speed-presets .preset-pill').forEach(pill => {
    pill.classList.toggle('active', parseInt(pill.dataset.delay, 10) === val);
  });
}

function clearText() {
  const ta = document.getElementById('text-input');
  ta.value = '';
  updateCharCount();
  ta.focus();
  triggerHaptic(8);
}

async function sendText() {
  let text = document.getElementById('text-input').value;
  if (!text) {
    showToast('Please enter some text');
    return;
  }

  if (State.config.autoenter) {
    text += '\n';
  }

  triggerHaptic(15);
  setTypingUI(true, text.length);

  try {
    const res = await fetch('/api/type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
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
    showToast('Failed to connect to server');
  }
}

async function stopTyping() {
  triggerHaptic(20);
  try {
    await fetch('/api/stop', { method: 'POST' });
  } catch (e) {}
}

function setTypingUI(isTyping, totalChars = 0) {
  State.isTyping = isTyping;
  const sendBtn = document.getElementById('btn-send');
  const stopBtn = document.getElementById('btn-stop');
  const pWrapper = document.getElementById('progress-wrapper');
  const pText = document.getElementById('progress-text');

  if (isTyping) {
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    pWrapper.style.display = 'block';
    pText.innerText = `Typing ${totalChars} characters (${State.delayMs}ms/char)...`;
    animateProgressBar(totalChars * State.delayMs);
  } else {
    sendBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    pWrapper.style.display = 'none';
    document.getElementById('progress-fill').style.width = '0%';
  }
}

function animateProgressBar(totalTimeMs) {
  const fill = document.getElementById('progress-fill');
  fill.style.transition = `width ${totalTimeMs / 1000.0}s linear`;
  setTimeout(() => {
    if (State.isTyping) fill.style.width = '100%';
  }, 20);
}

// ── View 2: Live Keyboard (SwiftKey / Gboard Mirror) ───────────────────────────

function initLiveKeyboard() {
  const input = document.getElementById('live-hidden-input');
  const zone = document.getElementById('live-target-zone');
  const hint = document.getElementById('live-hint-text');

  let lastValue = '';
  let lastActionTime = 0;
  let lastActionChar = null;
  let resetTimer = null;

  function emitChar(ch) {
    if (!ch) return;
    const now = Date.now();
    // Normalize newlines and tabs
    if (ch === '\n' || ch === '\r') ch = 'Enter';
    if (ch === '\t') ch = 'Tab';

    // De-duplicate if the EXACT same key was emitted from a concurrent event within 35ms
    if (ch === lastActionChar && (now - lastActionTime) < 35) {
      return;
    }
    lastActionChar = ch;
    lastActionTime = now;
    sendLiveChar(ch);
  }

  input.addEventListener('focus', () => {
    zone.classList.add('focused');
    hint.innerText = '🟢 Keyboard active — type now';
    input.value = '';
    lastValue = '';
  });

  input.addEventListener('blur', () => {
    zone.classList.remove('focused');
    hint.innerText = '⌨️ Tap to open device keyboard';
    input.value = '';
    lastValue = '';
  });

  // 1. Keydown: physical keys + virtual Backspace/Enter/Tab/Esc
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' || e.keyCode === 8) {
      emitChar('Backspace');
      if (!input.value) e.preventDefault();
    } else if (e.key === 'Enter' || e.keyCode === 13) {
      emitChar('Enter');
      e.preventDefault();
    } else if (e.key === 'Tab' || e.keyCode === 9) {
      emitChar('Tab');
      e.preventDefault();
    } else if (e.key === 'Escape' || e.keyCode === 27) {
      emitChar('Esc');
      e.preventDefault();
    } else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && e.key !== 'Unidentified') {
      emitChar(e.key);
      e.preventDefault();
    }
  });

  // 2. Beforeinput: line breaks and backwards deletion
  input.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'insertLineBreak') {
      emitChar('Enter');
      e.preventDefault();
    } else if (e.inputType === 'deleteContentBackward') {
      emitChar('Backspace');
    }
  });

  // 3. Input event: Universal capture for all virtual keyboards (SwiftKey, Gboard, IME)
  input.addEventListener('input', () => {
    const curValue = input.value;

    if (curValue.length > lastValue.length) {
      // Find common prefix to detect exactly what characters were added
      let prefixLen = 0;
      while (prefixLen < lastValue.length && prefixLen < curValue.length && lastValue[prefixLen] === curValue[prefixLen]) {
        prefixLen++;
      }
      // If previous characters were replaced (autocorrect/prediction)
      const removedCount = lastValue.length - prefixLen;
      for (let i = 0; i < removedCount; i++) {
        emitChar('Backspace');
      }
      // Emit newly added characters
      const addedText = curValue.slice(prefixLen);
      for (const ch of addedText) {
        emitChar(ch);
      }
    } else if (curValue.length < lastValue.length) {
      // Characters deleted
      const diff = lastValue.length - curValue.length;
      for (let i = 0; i < diff; i++) {
        emitChar('Backspace');
      }
    }

    lastValue = curValue;

    // Reset buffer after pause or when long to keep diffing fast and prevent overflow
    clearTimeout(resetTimer);
    if (curValue.length > 25) {
      input.value = '';
      lastValue = '';
    } else {
      resetTimer = setTimeout(() => {
        input.value = '';
        lastValue = '';
      }, 1500);
    }
  });

  // 4. Composition end: handles any committed text buffer
  input.addEventListener('compositionend', () => {
    const curValue = input.value;
    if (curValue.length > lastValue.length) {
      const addedText = curValue.slice(lastValue.length);
      for (const ch of addedText) {
        emitChar(ch);
      }
    }
    input.value = '';
    lastValue = '';
  });
}

function focusLiveInput() {
  const input = document.getElementById('live-hidden-input');
  input.focus();
  triggerHaptic(10);
}

function sendLiveChar(ch) {
  triggerHaptic(8);
  appendKeyChip(ch);

  // Send over WebSocket for lowest latency (sub-5ms)
  if (State.ws && State.ws.readyState === WebSocket.OPEN) {
    State.ws.send(JSON.stringify({ action: 'live_char', char: ch }));
  } else {
    // Fallback REST call
    fetch('/api/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ch })
    });
  }
}

function appendKeyChip(label) {
  const feed = document.getElementById('key-feed');
  const emptyHint = feed.querySelector('.empty-feed-hint');
  if (emptyHint) emptyHint.remove();

  const chip = document.createElement('span');
  chip.className = 'key-chip';
  chip.innerText = label === ' ' ? '␣' : label;

  feed.appendChild(chip);

  // Keep feed bounded to last 15 keys
  while (feed.children.length > 15) {
    feed.removeChild(feed.firstChild);
  }
  feed.scrollLeft = feed.scrollWidth;
}

function clearKeyFeed() {
  const feed = document.getElementById('key-feed');
  feed.innerHTML = '<span class="empty-feed-hint">Waiting for input...</span>';
}

function sendSingleKey(keyName) {
  triggerHaptic(12);
  sendLiveChar(keyName);
}

// ── View 3: Shortcuts & Combos ─────────────────────────────────────────────────

async function sendCombo(combo) {
  triggerHaptic(15);
  showToast(`Injected ${combo.toUpperCase()}`);
  try {
    await fetch('/api/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ combo: combo })
    });
  } catch (e) {}
}

// ── View 4: Trackpad ──────────────────────────────────────────────────────────

function initTrackpad() {
  const surface = document.getElementById('touchpad-surface');
  let lastX = 0;
  let lastY = 0;
  let isMoving = false;
  let tapStartTime = 0;
  let startX = 0;
  let startY = 0;

  surface.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      startX = lastX;
      startY = lastY;
      isMoving = true;
      tapStartTime = Date.now();
    }
  }, { passive: false });

  surface.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isMoving || e.touches.length !== 1) return;

    const curX = e.touches[0].clientX;
    const curY = e.touches[0].clientY;
    const dx = Math.round((curX - lastX) * 1.5);
    const dy = Math.round((curY - lastY) * 1.5);
    lastX = curX;
    lastY = curY;

    if (dx !== 0 || dy !== 0) {
      if (State.ws && State.ws.readyState === WebSocket.OPEN) {
        State.ws.send(JSON.stringify({ action: 'mouse_move', dx: dx, dy: dy }));
      }
    }
  }, { passive: false });

  surface.addEventListener('touchend', (e) => {
    e.preventDefault();
    isMoving = false;
    const duration = Date.now() - tapStartTime;
    const totalDist = Math.hypot(lastX - startX, lastY - startY);

    // Tap detection: short duration and little to no movement
    if (duration < 220 && totalDist < 8) {
      onMouseClick(1); // Left Click
    }
  }, { passive: false });

  // Pointer / Mouse fallback for desktop or stylus
  let isMouseDown = false;
  surface.addEventListener('mousedown', (e) => {
    lastX = e.clientX;
    lastY = e.clientY;
    isMouseDown = true;
    tapStartTime = Date.now();
    startX = lastX;
    startY = lastY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    const curX = e.clientX;
    const curY = e.clientY;
    const dx = Math.round((curX - lastX) * 1.5);
    const dy = Math.round((curY - lastY) * 1.5);
    lastX = curX;
    lastY = curY;
    if (dx !== 0 || dy !== 0) {
      if (State.ws && State.ws.readyState === WebSocket.OPEN) {
        State.ws.send(JSON.stringify({ action: 'mouse_move', dx: dx, dy: dy }));
      }
    }
  });
  window.addEventListener('mouseup', () => {
    if (!isMouseDown) return;
    isMouseDown = false;
    const duration = Date.now() - tapStartTime;
    const totalDist = Math.hypot(lastX - startX, lastY - startY);
    if (duration < 220 && totalDist < 8) {
      onMouseClick(1);
    }
  });
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
    });
  }
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function openSettings() {
  document.getElementById('settings-modal').classList.add('open');
  triggerHaptic(8);
  fetchInitialStatus();
}

function closeSettings() {
  document.getElementById('settings-modal').classList.remove('open');
  triggerHaptic(8);
}

// ── Toast Utility ─────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}
