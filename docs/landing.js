/**
 * EMITTR: Launch Experience engine
 * No dependencies. Native scroll + damped progress values per pinned scene.
 *
 *  hero      parallax phone, headline exit
 *  wall      policy strike-throughs → "A keyboard. Allowed."
 *  become    word-by-word reveal
 *  type      scroll scrubs a 64-char passphrase through the cable
 *  missions  vertical scroll drives a horizontal rail + line-art drawing
 *  touch     rate-based thumbsticks driving an endless spreadsheet
 *  bytes     live HID report sequencer
 *  finale    logo line drawing
 */
(() => {
  'use strict';

  // ── helpers ──────────────────────────────────────────────────────────────
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const hex = n => (n & 255).toString(16).padStart(2, '0').toUpperCase();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => innerWidth <= 960;
  if (reduced) document.documentElement.classList.add('rm');

  // ── pointer (spotlight + parallax) ───────────────────────────────────────
  const ptr = { nx: 0, ny: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', e => {
    ptr.nx = (e.clientX / innerWidth - 0.5) * 2;
    ptr.ny = (e.clientY / innerHeight - 0.5) * 2;
    const r = document.documentElement.style;
    r.setProperty('--mx', e.clientX + 'px');
    r.setProperty('--my', e.clientY + 'px');
  }, { passive: true });

  // ── intro → ready ────────────────────────────────────────────────────────
  const skipIntro = scrollY > 40 || reduced;
  setTimeout(() => document.body.classList.add('ready'), skipIntro ? 0 : 3100);

  // ── toast ────────────────────────────────────────────────────────────────
  const toastEl = $('#toast');
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('on'), 2200);
  }

  // ── reveal on view ───────────────────────────────────────────────────────
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  $$('.rv, .term').forEach(el => io.observe(el));

  // ── HID helpers ──────────────────────────────────────────────────────────
  function hidOf(ch) {
    if (/[a-z]/.test(ch)) return [0, 0x04 + ch.charCodeAt(0) - 97];
    if (/[A-Z]/.test(ch)) return [2, 0x04 + ch.charCodeAt(0) - 65];
    if (/[1-9]/.test(ch)) return [0, 0x1E + ch.charCodeAt(0) - 49];
    if (ch === '0') return [0, 0x27];
    const m = { '-': [0, 0x2D], '_': [2, 0x2D], ' ': [0, 0x2C], ',': [0, 0x36], '.': [0, 0x37] };
    return m[ch] || [0, 0];
  }

  // ── thread: the cable that fills as you read ─────────────────────────────
  const th = { base: $('#threadBase'), fill: $('#threadFill'), head: $('#threadHead'), len: 0 };
  function buildThread() {
    if (narrow()) return;
    const h = innerHeight, q = h / 16;
    let d = `M14 0 Q 26 ${q} 14 ${2 * q}`;
    for (let i = 2; i <= 8; i++) d += ` T 14 ${2 * q * i}`;
    th.base.setAttribute('d', d);
    th.fill.setAttribute('d', d);
    th.len = th.fill.getTotalLength();
    th.fill.style.strokeDasharray = th.len;
  }
  function updateThread() {
    if (!th.len) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? clamp(scrollY / max) : 0;
    th.fill.style.strokeDashoffset = th.len * (1 - p);
    const pt = th.fill.getPointAtLength(th.len * p);
    th.head.setAttribute('cx', pt.x);
    th.head.setAttribute('cy', pt.y);
  }

  // ── typewriter for the hero phone ────────────────────────────────────────
  (function heroTypewriter() {
    const el = $('#heroType');
    const chEl = $('#heroChars');
    const plEl = $('#heroTypePlaceholder');
    const lines = ['sudo reboot --bios', 'ssh root@vault-01', 'WAR MACHINE ROX', 'dmesg | grep -i usb', 'correct-horse-battery-staple'];
    let li = 0, ci = 0, dir = 1;
    (function tick() {
      const s = lines[li];
      ci += dir;
      el.textContent = s.slice(0, ci);
      if (chEl) chEl.textContent = ci + ' chars';
      if (plEl) plEl.style.opacity = ci > 0 ? '0' : '1';
      let wait = dir > 0 ? 55 + Math.random() * 55 : 22;
      if (dir > 0 && ci >= s.length) { dir = -1; wait = 1700; }
      else if (dir < 0 && ci <= 0) { dir = 1; li = (li + 1) % lines.length; wait = 420; }
      setTimeout(tick, wait);
    })();
  })();

  // ═════════════════════ SCENE HANDLERS ═══════════════════════════════════

  // 01 · hero
  const heroCopy = $('#heroCopy'), heroTilt = $('#heroTilt');
  function hero(p) {
    ptr.sx = lerp(ptr.sx, ptr.nx, 0.06);
    ptr.sy = lerp(ptr.sy, ptr.ny, 0.06);
    heroCopy.style.transform = `translate3d(0, ${-p * 90}px, 0)`;
    heroCopy.style.opacity = clamp(1 - p * 1.7);
    const e = ease(p);
    heroTilt.style.transform =
      `rotateY(${-16 + e * 16 + ptr.sx * 7}deg) rotateX(${6 - e * 6 - ptr.sy * 5}deg) rotateZ(${-3 + e * 3}deg) ` +
      `translateY(${-e * 5}vh) scale(${1 + e * 0.22})`;
  }

  // 02 · wall
  const wallRows = $$('.wall-row');
  const wallFoot = $('#wallFoot');
  function wall(p) {
    const n = wallRows.length - 1;
    wallRows.forEach((row, i) => {
      if (i < n) {
        const t = clamp((p - 0.07 - i * 0.17) / 0.13);
        const e = ease(t);
        $('.strike', row).style.transform = `scaleX(${e})`;
        row.style.opacity = lerp(1, 0.24, e);
      } else {
        const t = clamp((p - 0.78) / 0.14);
        row.style.opacity = lerp(0.35, 1, ease(t));
        row.classList.toggle('lit', t > 0.45);
      }
    });
    const f = clamp((p - 0.9) / 0.1);
    wallFoot.style.opacity = f;
    wallFoot.style.transform = `translateY(${(1 - f) * 20}px)`;
  }

  // 03 · become
  const words = $$('#becomeText .w');
  const becomeSub = $('#becomeSub');
  function become(p) {
    const N = words.length;
    words.forEach((w, i) => {
      const t = clamp((p * 1.15 * N - i) / 1.6);
      w.style.opacity = lerp(0.1, 1, t);
      w.style.filter = `blur(${(1 - t) * 8}px)`;
    });
    const s = clamp((p - 0.72) / 0.18);
    becomeSub.style.opacity = s;
    becomeSub.style.transform = `translateY(${(1 - s) * 18}px)`;
  }

  // 04 · proof (automatic typing upon reaching the page, stays completed)
  const PASS = (() => {
    const set = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789-_';
    let s = 1337, out = '';
    for (let i = 0; i < 64; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; out += set[(s >>> 8) % set.length]; }
    return out;
  })();
  const typeEl = {
    stick: $('#typeStick'), screen: $('#typeScreen'), pass: $('#typedPass'), status: $('#loginStatus'),
    insp: $('#inspector'), field: $('#phoneField'), send: $('#phoneSend'), stat: $('#statChars'),
  };

  const typeState = {
    hasStarted: false,
    isTyping: false,
    isDone: false,
    timer: null,
  };

  function renderTypingStep(n) {
    if (typeEl.pass) typeEl.pass.textContent = PASS.slice(0, n);
    if (typeEl.field) typeEl.field.innerHTML = `<span class="sent">${PASS.slice(0, n)}</span><span class="rest">${PASS.slice(n)}</span>`;
    if (typeEl.stat) typeEl.stat.textContent = n;
    if (n > 0) {
      const [mod, key] = hidOf(PASS[n - 1]);
      if (typeEl.insp) typeEl.insp.innerHTML = `<b>HID →</b> 01 ${hex(mod)} 00 ${hex(key)} 00 00 00 00 00`;
    } else {
      if (typeEl.insp) typeEl.insp.innerHTML = '<b>HID →</b> 01 00 00 00 00 00 00 00 00';
    }
  }

  function startAutoType() {
    if (typeof updateTypeCable === 'function') updateTypeCable();
    if (typeState.timer) clearInterval(typeState.timer);
    typeState.hasStarted = true;
    typeState.isTyping = true;
    typeState.isDone = false;

    let n = 0;
    renderTypingStep(0);
    if (typeEl.stick) typeEl.stick.classList.add('live');
    if (typeEl.screen) typeEl.screen.classList.remove('ok');
    if (typeEl.send) {
      typeEl.send.classList.remove('done');
      typeEl.send.textContent = 'Typing…';
    }
    if (typeEl.status) typeEl.status.textContent = 'Receiving keystrokes from Standard USB keyboard…';

    const interval = 28;
    typeState.timer = setInterval(() => {
      n++;
      renderTypingStep(n);

      if (n >= PASS.length) {
        clearInterval(typeState.timer);
        typeState.timer = null;
        typeState.isTyping = false;
        typeState.isDone = true;

        if (typeEl.stick) typeEl.stick.classList.remove('live');
        if (typeEl.screen) typeEl.screen.classList.add('ok');
        if (typeEl.send) {
          typeEl.send.classList.add('done');
          typeEl.send.textContent = 'Sent ✓';
        }
        if (typeEl.status) typeEl.status.textContent = 'Access granted: vault-01 unlocked';
      }
    }, interval);
  }

  // Allow clicking "Type it" on the phone to replay on demand
  if (typeEl.send) {
    typeEl.send.style.cursor = 'pointer';
    typeEl.send.addEventListener('click', () => {
      startAutoType();
    });
  }

  // Pre-fill phone field initially with the full secret ready to send
  if (typeEl.field) {
    typeEl.field.innerHTML = `<span class="rest">${PASS}</span>`;
  }

  function typeScene(p) {
    if (reduced) {
      typeState.hasStarted = true;
      typeState.isDone = true;
      renderTypingStep(PASS.length);
      if (typeEl.stick) typeEl.stick.classList.remove('live');
      if (typeEl.screen) typeEl.screen.classList.add('ok');
      if (typeEl.send) {
        typeEl.send.classList.add('done');
        typeEl.send.textContent = 'Sent ✓';
      }
      if (typeEl.status) typeEl.status.textContent = 'Access granted: vault-01 unlocked';
      return;
    }

    if (!typeState.hasStarted) {
      if (p > 0.02 || (typeEl.stick && typeEl.stick.getBoundingClientRect().top < innerHeight * 0.75)) {
        startAutoType();
      }
    }
  }

  // Also observe intersection as a rock-solid backup
  if (typeof IntersectionObserver !== 'undefined' && typeEl.stick) {
    const typeObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !typeState.hasStarted) {
          startAutoType();
        }
      });
    }, { threshold: 0.15 });
    typeObserver.observe(typeEl.stick);
  }

  // 05 · missions
  const mTrack = $('#missionsTrack'), mRail = $('#missionsRail');
  const panels = $$('.mission').map(el => ({
    el,
    num: $('.m-num', el),
    paths: $$('.d', el),
    copy: $('.m-copy', el),
    lastOff: -1,
    lastOp: -1,
  }));
  const mCount = $('#mCount'), mProg = $('#mProg');
  let mMax = 0;
  let lastMCount = -1;
  let lastRailX = '';
  let lastMProg = -1;

  function sizeMissions() {
    mMax = Math.max(0, mRail.scrollWidth - innerWidth);
    mTrack.style.height = (Math.round(mMax * 0.65) + innerHeight) + 'px';
  }

  function missions(p) {
    const rx = (-p * mMax).toFixed(2);
    if (rx !== lastRailX) {
      lastRailX = rx;
      mRail.style.transform = `translate3d(${rx}px,0,0)`;
    }

    const idx = p * (panels.length - 1);

    for (let i = 0; i < panels.length; i++) {
      const pn = panels[i];
      const d = idx - i;
      const absD = Math.abs(d);

      // Skip offscreen panels and clamp them once
      if (absD > 1.25) {
        if (pn.lastOff !== 1) {
          pn.lastOff = 1;
          for (let j = 0; j < pn.paths.length; j++) {
            pn.paths[j].style.strokeDashoffset = 1;
          }
        }
        if (pn.lastOp !== 0.18) {
          pn.lastOp = 0.18;
          pn.copy.style.opacity = 0.18;
        }
        continue;
      }

      const t = 1 - clamp(absD / 0.85);
      const off = +(1 - easeOut(t)).toFixed(3);
      if (off !== pn.lastOff) {
        pn.lastOff = off;
        for (let j = 0; j < pn.paths.length; j++) {
          pn.paths[j].style.strokeDashoffset = off;
        }
      }

      const op = +lerp(0.18, 1, clamp(t * 1.4)).toFixed(3);
      if (op !== pn.lastOp) {
        pn.lastOp = op;
        pn.copy.style.opacity = op;
      }
    }

    const cur = Math.min(panels.length, Math.max(1, Math.round(idx) + 1));
    if (cur !== lastMCount) {
      lastMCount = cur;
      mCount.textContent = String(cur).padStart(2, '0');
    }

    const pFixed = +p.toFixed(4);
    if (pFixed !== lastMProg) {
      lastMProg = pFixed;
      mProg.style.transform = `scaleX(${pFixed})`;
    }
  }

  // 09 · finale
  const fLogo = $('#finaleLogo');
  const fAf = $('.faf', fLogo);
  const fWire = $('.fdr.wire', fLogo);
  const fPlug = $$('.fig.b .fdr', fLogo);
  const fFade = $('.ffadeg', fLogo);
  const fLetters = $$('.fig.c .fdr', fLogo);
  const fH = $$('.finale-h span'), fLinks = $('#finaleLinks');

  function finale(p) {
    // 1 · arrow plane (draws and scales into view)
    const kArrow = clamp(p / 0.08);
    if (fAf) {
      fAf.style.opacity = kArrow.toFixed(3);
      fAf.style.strokeDashoffset = (1 - easeOut(kArrow)).toFixed(3);
      fAf.style.transform = `scale(${(0.88 + 0.12 * kArrow).toFixed(3)})`;
    }

    // 2 · wire cable draws continuously
    const kWire = ease(clamp((p - 0.04) / 0.20));
    if (fWire) {
      fWire.style.strokeDashoffset = (1 - kWire).toFixed(3);
    }

    // 3 · USB plug outline
    const kPlug = ease(clamp((p - 0.20) / 0.10));
    fPlug.forEach(pEl => {
      pEl.style.strokeDashoffset = (1 - kPlug).toFixed(3);
    });

    // 4 · USB pins and connector icon
    const kFade = clamp((p - 0.26) / 0.08);
    if (fFade) {
      fFade.style.opacity = kFade.toFixed(3);
    }

    // 5 · EMITTR wordmark letters draw sequentially
    fLetters.forEach((pEl, i) => {
      const kL = ease(clamp((p - 0.28 - i * 0.022) / 0.07));
      pEl.style.strokeDashoffset = (1 - kL).toFixed(3);
    });

    // 6 · finale headline
    fH.forEach((s, i) => {
      const k = clamp((p - 0.44 - i * 0.10) / 0.14);
      s.style.opacity = k.toFixed(3);
      s.style.transform = `translateY(${((1 - k) * 24).toFixed(1)}px)`;
    });

    // 7 · action links
    const l = clamp((p - 0.70) / 0.14);
    if (fLinks) {
      fLinks.style.opacity = l.toFixed(3);
      fLinks.style.transform = `translateY(${((1 - l) * 24).toFixed(1)}px)`;
    }
  }

  // ═════════════════════ SCENE REGISTRY + MAIN LOOP ═══════════════════════
  const handlers = { hero, wall, become, type: typeScene, missions, finale };
  const scenes = $$('[data-scene]').map(el => ({ el, name: el.dataset.scene, p: 0, sp: 0, init: false }));
  const labeled = $$('[data-label]');
  const labelEl = $('#sceneLabel');
  const labelN = $('.n', labelEl), labelT = $('.t', labelEl);
  let curLabel = -1;

  // touch (sticks) state is defined below but ticked from the same loop
  let touchTick = () => {};
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const vh = innerHeight;

    for (const s of scenes) {
      const r = s.el.getBoundingClientRect();
      if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) continue;
      const total = r.height - vh;
      s.p = total > 0 ? clamp(-r.top / total) : 0;
      if (!s.init) { s.sp = s.p; s.init = true; }
      const factor = reduced ? 1 : (s.name === 'missions' ? 0.22 : 0.15);
      s.sp += (s.p - s.sp) * factor;
      if (Math.abs(s.p - s.sp) < 0.0003) s.sp = s.p;
      handlers[s.name](s.sp);
    }

    // active scene label
    let idx = -1;
    labeled.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.top <= vh * 0.5 && r.bottom > vh * 0.5) idx = i;
    });
    if (idx !== -1 && idx !== curLabel) {
      curLabel = idx;
      labelEl.classList.add('swap');
      setTimeout(() => {
        labelN.textContent = String(idx + 1).padStart(2, '0');
        labelT.textContent = labeled[idx].dataset.label;
        labelEl.classList.remove('swap');
      }, 260);
    }

    updateThread();
    touchTick(now, dt);
    requestAnimationFrame(frame);
  }

  // ═════════════════════ TOUCH: thumbsticks + endless sheet ═══════════════
  (function initTouch() {
    const sec = $('#touch'), sheet = $('#sheet');
    const C = 10, R = 28, CW = 200, RH = 46;
    const BW = C * CW, BH = R * RH;
    const regions = ['North America', 'EMEA Central', 'Asia Pacific', 'Latin America', 'Nordics', 'Global Ops', 'Iberia', 'ANZ'];
    const sectors = ['Cloud Compute', 'Edge Firmware', 'Hardware Sec', 'Kernel ConfigFS', 'Networking', 'HID Gadget'];
    const risks = ['LOW', 'MINIMAL', 'NOMINAL', 'SECURE', 'OPTIMAL'];
    function cellText(c, r) {
      const h = ((r * 7919 + c * 104729) >>> 0) % 997;
      switch (c) {
        case 0: return '#' + String(1000 + r * 13 % 900);
        case 1: return regions[(r + c) % regions.length];
        case 2: return sectors[(r * 3 + c) % sectors.length];
        case 3: return '$' + (60 + (h * 7) % 400) + ',' + String(100 + (h * 13) % 900);
        case 4: return '$' + (60 + (h * 11) % 400) + ',' + String(100 + (h * 17) % 900);
        case 5: return (h % 2 ? '+' : '−') + ((h % 180) / 10).toFixed(1) + '%';
        case 6: return ((h % 600) / 10 + 20).toFixed(1) + '%';
        case 7: return risks[h % risks.length];
        case 8: return '0x' + hex(h) + hex(h * 3);
        default: return 'Q' + (1 + h % 4) + ' · ' + (2020 + h % 7);
      }
    }
    sheet.style.gridTemplateColumns = `repeat(${C * 2}, ${CW}px)`;
    const frag = document.createDocumentFragment();
    for (let rr = 0; rr < R * 2; rr++) {
      for (let cc = 0; cc < C * 2; cc++) {
        const d = document.createElement('div');
        const c = cc % C, r = rr % R;
        d.className = 'cell' + ((r * 5 + c * 3) % 17 === 0 ? ' hot' : '');
        d.textContent = cellText(c, r);
        frag.appendChild(d);
      }
    }
    sheet.appendChild(frag);

    const pos = { x: 0, y: 0 };
    const S = {
      v: { d: 0, sm: 0, active: false, well: $('#wellV'), knob: $('#knobV'), val: $('#valV'), axis: 'y' },
      h: { d: 0, sm: 0, active: false, well: $('#wellH'), knob: $('#knobH'), val: $('#valH'), axis: 'x' },
    };
    let lastTouch = -1e9, inView = false;
    new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: 0.05 }).observe(sec);

    Object.values(S).forEach(st => {
      const { well, knob, axis } = st;
      const move = e => {
        const r = well.getBoundingClientRect();
        const R_ = r.width * 0.27;
        let off = axis === 'y' ? e.clientY - (r.top + r.height / 2) : e.clientX - (r.left + r.width / 2);
        off = clamp(off, -R_, R_);
        knob.style.transform = axis === 'y' ? `translate(0, ${off}px)` : `translate(${off}px, 0)`;
        st.d = off / R_;
      };
      well.addEventListener('pointerdown', e => {
        well.setPointerCapture(e.pointerId);
        st.active = true; lastTouch = performance.now();
        knob.classList.add('grab'); move(e);
      });
      well.addEventListener('pointermove', e => { if (st.active) { lastTouch = performance.now(); move(e); } });
      const up = () => {
        if (!st.active) return;
        st.active = false; st.d = 0; lastTouch = performance.now();
        knob.classList.remove('grab'); knob.style.transform = 'translate(0,0)';
      };
      well.addEventListener('pointerup', up);
      well.addEventListener('pointercancel', up);
    });

    const curve = d => Math.sign(d) * Math.pow(Math.abs(d), 1.7);
    touchTick = (now, dt) => {
      if (!inView) return;
      const idle = now - lastTouch > 3200 && !S.v.active && !S.h.active;
      let tv = S.v.d, th_ = S.h.d;
      if (idle) {
        // attract mode: the sticks gently move on their own until touched
        tv = Math.sin(now / 1500) * 0.5;
        th_ = Math.cos(now / 2100) * 0.66;
        [S.v, S.h].forEach((st, i) => {
          const R_ = st.well.clientWidth * 0.27;
          const val = i === 0 ? tv : th_;
          st.knob.classList.add('grab');
          st.knob.style.transform = st.axis === 'y' ? `translate(0, ${val * R_}px)` : `translate(${val * R_}px, 0)`;
        });
      } else {
        [S.v, S.h].forEach(st => { if (!st.active) st.knob.classList.remove('grab'); });
      }
      const k = Math.min(1, dt * 9);
      S.v.sm += (tv - S.v.sm) * k;
      S.h.sm += (th_ - S.h.sm) * k;
      pos.y += curve(S.v.sm) * 1500 * dt;
      pos.x += curve(S.h.sm) * 1900 * dt;
      const x = -(((pos.x % BW) + BW) % BW), y = -(((pos.y % BH) + BH) % BH);
      sheet.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      S.v.val.textContent = (S.v.sm >= 0 ? '+' : '−') + Math.abs(S.v.sm).toFixed(2);
      S.h.val.textContent = (S.h.sm >= 0 ? '+' : '−') + Math.abs(S.h.sm).toFixed(2);
    };
  })();

  // ═════════════════════ BYTES: live HID report sequencer ═════════════════
  (function initBytes() {
    const sec = $('#bytes');
    const kCells = $$('#repK .byte'), mCells = $$('#repM .byte');
    const keyChar = $('#keyChar'), keyInfo = $('#keyInfo');
    let inView = false;
    new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: 0.15 }).observe(sec);

    function setBytes(cells, vals, pulse) {
      vals.forEach((v, i) => {
        const c = cells[i], vEl = c.firstElementChild, nv = hex(v);
        if (vEl.textContent !== nv) {
          vEl.textContent = nv;
          if (pulse) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
        }
        c.classList.toggle('on', v !== 0 && i > 0);
      });
    }

    const phrase = 'Hello, BIOS.';
    let i = 0, phase = 0;
    setInterval(() => {
      if (!inView) return;
      if (phase === 0) {
        const ch = phrase[i], [mod, key] = hidOf(ch);
        setBytes(kCells, [1, mod, 0, key, 0, 0, 0, 0, 0], true);
        keyChar.textContent = ch === ' ' ? '␣' : ch;
        keyChar.classList.add('tap');
        keyInfo.textContent = `${ch === ' ' ? 'Space' : '“' + ch + '”'} → ${mod ? 'Shift 0x02 + ' : ''}key 0x${hex(key)}`;
        phase = 1;
      } else {
        setBytes(kCells, [1, 0, 0, 0, 0, 0, 0, 0, 0], false);
        keyChar.classList.remove('tap');
        phase = 0; i = (i + 1) % phrase.length;
      }
    }, 330);

    setInterval(() => {
      if (!inView) return;
      const pan = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 4));
      const dx = Math.floor(Math.random() * 25) - 12, dy = Math.floor(Math.random() * 25) - 12;
      setBytes(mCells, [2, 0, dx, dy, 0, pan], true);
      mCells[5].classList.add('on');
    }, 1100);
  })();

  // ═════════════════════ INSTALL: copy ════════════════════════════════════
  $('#copyCmd').addEventListener('click', () => {
    const text = [
      'git clone https://github.com/mr-anjaneyam/Emittr.git',
      'cd Emittr && bash install.sh',
      'cp /opt/usb_hid_deck/02-usb-deck.sh /data/adb/service.d/',
      'chmod +x /data/adb/service.d/02-usb-deck.sh',
    ].join('\n');
    const done = () => toast('Commands copied');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
    else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (_) {} ta.remove(); done(); }
  });

  // ═════════════════════ boot ═════════════════════════════════════════════
  const typeCableSvg = $('.type-cable'), typeCableBase = $('.type-cable .base'), typeCableFlow = $('.type-cable .flow');
  const typePhone = $('.type-phone'), typePort = $('.monitor-port'), typeStick = $('#typeStick');
  function updateTypeCable() {
    if (!typeStick || !typePhone || !typePort || !typeCableSvg || !typeCableBase) return;
    const sR = typeStick.getBoundingClientRect();
    const phR = typePhone.getBoundingClientRect();
    const poR = typePort.getBoundingClientRect();
    if (phR.width === 0 || poR.width === 0 || sR.width === 0) return;

    const x1 = phR.left - sR.left + phR.width * 0.5;
    const y1 = phR.bottom - sR.top - 2;
    const x2 = poR.left - sR.left + poR.width * 0.5;
    const y2 = poR.bottom - sR.top + 2;

    typeCableSvg.setAttribute('viewBox', `0 0 ${sR.width} ${sR.height}`);
    typeCableSvg.removeAttribute('preserveAspectRatio');

    const dx = x2 - x1;
    const floor = sR.height - 18;
    const sag = Math.min(floor, Math.max(y1, y2) + 55);
    const cp1x = x1 + dx * 0.28;
    const cp1y = sag;
    const cp2x = x1 + dx * 0.72;
    const cp2y = sag * 0.8 + y2 * 0.2;
    const d = `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    typeCableBase.setAttribute('d', d);
    typeCableFlow.setAttribute('d', d);
  }

  function layout() { buildThread(); sizeMissions(); updateTypeCable(); }
  addEventListener('resize', layout);
  addEventListener('load', layout);
  setTimeout(layout, 100);
  layout();

  if (reduced) {
    // Show every scene in its resolved state; skip scrubbing & the rail.
    ['hero', 'wall', 'become', 'type', 'finale'].forEach(k => handlers[k](1));
    panels.forEach(pn => pn.paths.forEach(p => { p.style.strokeDashoffset = 0; }));
    mRail.style.transform = 'none';
    mRail.style.position = 'relative';
  } else {
    requestAnimationFrame(frame);
  }

  // ── 04.5 · Local Network Relay Live Multi-Device Sequencer ──────────────
  function initRelayDemo() {
    const relaySection = $('#relay');
    if (!relaySection) return;

    const cards = [$('#driver0'), $('#driver1'), $('#driver2')].filter(Boolean);
    const wifiPipe = $('#wifiPipe');
    const bridgePhone = $('#bridgePhone');
    const wirePulse = $('#wirePulse');
    const targetMonitor = $('#targetMonitor');
    const termLiveText = $('#termLiveText');
    const termLiveLog = $('#termLiveLog');

    if (!cards.length || !termLiveText || !termLiveLog) return;

    const snippets = [
      {
        text: 'password: WAR MACHINE ROX',
        tag: '[AUTH OK]',
        msg: 'Password transmitted via USB HID'
      },
      {
        text: 'totp_token: 849 201',
        tag: '[VERIFIED]',
        msg: '2FA credential verified (0 software on host)'
      },
      {
        text: 'ssh admin@airgap-node',
        tag: '[CONNECTED]',
        msg: 'Hardware console established via /dev/hidg0'
      }
    ];

    let currentIdx = 0;
    let isRunning = false;
    let loopTimeout = null;
    let typingInterval = null;

    function step() {
      isRunning = true;
      clearTimeout(loopTimeout);
      clearInterval(typingInterval);

      const devIndex = currentIdx;
      const card = cards[devIndex];
      const snippetObj = snippets[devIndex];
      if (!card || !snippetObj) return;

      // 1. Highlight active device card
      cards.forEach((c, idx) => {
        if (idx === devIndex) c.classList.add('active');
        else {
          c.classList.remove('active');
          const f = c.querySelector('.driver-fill');
          if (f) f.style.width = '0%';
        }
      });

      // Reset terminal line
      termLiveText.textContent = '';
      termLiveLog.innerHTML = '<span class="term-status-tag" style="color:var(--dim)">[AWAITING]</span> <span class="term-status-msg">Listening on USB port...</span>';
      if (targetMonitor) targetMonitor.classList.remove('received');

      // 2. Press send button after brief beat
      loopTimeout = setTimeout(() => {
        const btn = card.querySelector('.driver-send-btn');
        if (btn) {
          btn.classList.add('btn-pressed');
          setTimeout(() => btn.classList.remove('btn-pressed'), 220);
        }

        // 3. Fill progress bar & start wireless/wire transmission indicators
        const fill = card.querySelector('.driver-fill');
        if (fill) fill.style.width = '100%';

        if (wifiPipe) wifiPipe.classList.add('transmitting');
        if (bridgePhone) bridgePhone.classList.add('relaying');
        if (wirePulse) wirePulse.classList.add('firing');

        termLiveLog.innerHTML = '<span class="term-status-tag" style="color:#60a5fa">[STREAMING]</span> <span class="term-status-msg">Transmitting keystrokes...</span>';

        // 4. Type character-by-character into Host PC terminal
        const str = snippetObj.text;
        let charIdx = 0;
        typingInterval = setInterval(() => {
          if (charIdx < str.length) {
            termLiveText.textContent += str[charIdx];
            charIdx++;
          } else {
            clearInterval(typingInterval);

            // 5. Finished typing: stop transmission pulses & flash success status
            if (wifiPipe) wifiPipe.classList.remove('transmitting');
            if (bridgePhone) bridgePhone.classList.remove('relaying');
            if (wirePulse) wirePulse.classList.remove('firing');

            if (targetMonitor) targetMonitor.classList.add('received');
            termLiveLog.innerHTML = `<span class="term-status-tag" style="color:#4ade80">${snippetObj.tag}</span> <span class="term-status-msg">${snippetObj.msg}</span>`;

            // 6. Hold for 1.6s, then advance to next device in loop
            loopTimeout = setTimeout(() => {
              currentIdx = (currentIdx + 1) % cards.length;
              step();
            }, 1600);
          }
        }, 36);
      }, 350);
    }

    // Manual click listener on cards / send buttons
    cards.forEach((card, idx) => {
      card.addEventListener('click', () => {
        currentIdx = idx;
        step();
      });
    });

    // Start initial step
    setTimeout(() => {
      step();
    }, 400);
  }

  // ── 04.5 · Interactive Physics-Based Hanging Cable ────────────────────────
  function initPhysicalCable() {
    const clusterRow = document.getElementById('clusterDevicesRow') || document.querySelector('.cluster-devices-row');
    const phoneSocket = document.getElementById('phoneUsbcSocket') || document.querySelector('.phone-usbc-socket');
    const monitorSocket = document.getElementById('monitorUsbaSocket') || document.querySelector('.monitor-usba-socket');
    const svg = document.getElementById('cableSvgCanvas');
    const shadowPath = document.getElementById('cableWireShadow');
    const jacketPath = document.getElementById('cableWireJacket');
    const corePath = document.getElementById('cableWireCore');
    const pulsePath = document.getElementById('wirePulse');

    if (!clusterRow || !phoneSocket || !monitorSocket || !svg) return;

    let p0 = { x: 48, y: 176 };
    let p3 = { x: 260, y: 162 };
    let restBelly = { x: 120, y: 215 };

    let posX = 0, posY = 0;
    let velX = 0, velY = 0;
    let isPointerNear = false;
    let isSleeping = false;
    let animId = null;
    let lastScrollY = window.scrollY;

    const mouse = { x: -9999, y: -9999, lastX: -9999, lastY: -9999, vx: 0, vy: 0 };

    function updateAnchors() {
      const rowRect = clusterRow.getBoundingClientRect();
      if (rowRect.width === 0 || rowRect.height === 0) return;

      svg.setAttribute('viewBox', `0 0 ${rowRect.width} ${rowRect.height}`);

      const pRect = phoneSocket.getBoundingClientRect();
      const mRect = monitorSocket.getBoundingClientRect();

      p0.x = (pRect.left + pRect.width / 2) - rowRect.left;
      p0.y = pRect.bottom - rowRect.top;

      p3.x = mRect.left - rowRect.left;
      p3.y = (mRect.top + mRect.height / 2) - rowRect.top;

      const dx = p3.x - p0.x;
      const sag = Math.max(34, Math.min(62, dx * 0.17));
      restBelly.x = p0.x + dx * 0.36;
      restBelly.y = Math.max(p0.y, p3.y) + sag;

      render();
    }

    function computePath(bx, by) {
      const dy1 = by - p0.y;
      const dx1 = bx - p0.x;
      const cp1x = p0.x;
      const cp1y = p0.y + dy1 * 0.65;
      const cp2x = bx - dx1 * 0.45;
      const cp2y = by;

      const dx2 = p3.x - bx;
      const cp3x = bx + dx2 * 0.42;
      const cp3y = by;
      const cp4x = p3.x - Math.max(16, dx2 * 0.32);
      const cp4y = p3.y;

      return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${bx.toFixed(1)} ${by.toFixed(1)} C ${cp3x.toFixed(1)} ${cp3y.toFixed(1)}, ${cp4x.toFixed(1)} ${cp4y.toFixed(1)}, ${p3.x.toFixed(1)} ${p3.y.toFixed(1)}`;
    }

    function render() {
      const curBx = restBelly.x + posX;
      const curBy = restBelly.y + posY;
      const d = computePath(curBx, curBy);

      if (shadowPath) shadowPath.setAttribute('d', d);
      if (jacketPath) jacketPath.setAttribute('d', d);
      if (corePath) corePath.setAttribute('d', d);
      if (pulsePath) pulsePath.setAttribute('d', d);
    }

    const stiffness = 0.048;
    const damping = 0.88;
    const touchRadius = 60;

    function wakeUp() {
      if (isSleeping) {
        isSleeping = false;
        animId = requestAnimationFrame(physicsLoop);
      }
    }

    function physicsLoop() {
      const forceX = -stiffness * posX;
      const forceY = -stiffness * posY;

      velX += forceX;
      velY += forceY;

      if (isPointerNear) {
        const curBx = restBelly.x + posX;
        const curBy = restBelly.y + posY;
        const distInfo = getMinDistanceToCable(mouse.x, mouse.y, curBx, curBy);

        if (distInfo.dist < touchRadius) {
          const factor = Math.pow(1 - distInfo.dist / touchRadius, 1.6);
          const angle = Math.atan2(distInfo.closestY - mouse.y, distInfo.closestX - mouse.x);

          const repelMag = factor * 4.8;
          velX += Math.cos(angle) * repelMag;
          velY += Math.sin(angle) * repelMag;

          velX += mouse.vx * 0.14 * factor;
          velY += mouse.vy * 0.14 * factor;
        }
      }

      velX *= damping;
      velY *= damping;

      velX = Math.max(-26, Math.min(26, velX));
      velY = Math.max(-26, Math.min(26, velY));

      posX += velX;
      posY += velY;

      render();

      const energy = Math.abs(posX) + Math.abs(posY) + Math.abs(velX) + Math.abs(velY);
      if (energy < 0.05 && !isPointerNear) {
        posX = 0;
        posY = 0;
        velX = 0;
        velY = 0;
        render();
        isSleeping = true;
        return;
      }

      animId = requestAnimationFrame(physicsLoop);
    }

    function getMinDistanceToCable(mx, my, curBx, curBy) {
      let minDist = Infinity;
      let closestX = curBx;
      let closestY = curBy;

      const dy1 = curBy - p0.y;
      const dx1 = curBx - p0.x;
      const cp1x = p0.x;
      const cp1y = p0.y + dy1 * 0.65;
      const cp2x = curBx - dx1 * 0.45;
      const cp2y = curBy;

      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const mt = 1 - t;
        const px = mt * mt * mt * p0.x + 3 * mt * mt * t * cp1x + 3 * mt * t * t * cp2x + t * t * t * curBx;
        const py = mt * mt * mt * p0.y + 3 * mt * mt * t * cp1y + 3 * mt * t * t * cp2y + t * t * t * curBy;
        const d = Math.hypot(mx - px, my - py);
        if (d < minDist) {
          minDist = d;
          closestX = px;
          closestY = py;
        }
      }

      const dx2 = p3.x - curBx;
      const cp3x = curBx + dx2 * 0.42;
      const cp3y = curBy;
      const cp4x = p3.x - Math.max(16, dx2 * 0.32);
      const cp4y = p3.y;

      for (let i = 1; i <= 6; i++) {
        const t = i / 6;
        const mt = 1 - t;
        const px = mt * mt * mt * curBx + 3 * mt * mt * t * cp3x + 3 * mt * t * t * cp4x + t * t * t * p3.x;
        const py = mt * mt * mt * curBy + 3 * mt * mt * t * cp3y + 3 * mt * t * t * cp4y + t * t * t * p3.y;
        const d = Math.hypot(mx - px, my - py);
        if (d < minDist) {
          minDist = d;
          closestX = px;
          closestY = py;
        }
      }

      return { dist: minDist, closestX, closestY };
    }

    function onPointerMove(e) {
      const rowRect = clusterRow.getBoundingClientRect();
      const margin = 80;
      if (
        e.clientX < rowRect.left - margin ||
        e.clientX > rowRect.right + margin ||
        e.clientY < rowRect.top - margin ||
        e.clientY > rowRect.bottom + margin
      ) {
        isPointerNear = false;
        return;
      }

      isPointerNear = true;
      const curX = e.clientX - rowRect.left;
      const curY = e.clientY - rowRect.top;

      if (mouse.lastX > -1000) {
        mouse.vx = curX - mouse.lastX;
        mouse.vy = curY - mouse.lastY;
      }
      mouse.lastX = curX;
      mouse.lastY = curY;
      mouse.x = curX;
      mouse.y = curY;

      wakeUp();
    }

    function onPointerLeave() {
      isPointerNear = false;
      mouse.x = -9999;
      mouse.y = -9999;
      mouse.lastX = -9999;
      mouse.lastY = -9999;
      mouse.vx = 0;
      mouse.vy = 0;
    }

    function onScroll() {
      const curScrollY = window.scrollY;
      const deltaY = curScrollY - lastScrollY;
      lastScrollY = curScrollY;

      const rowRect = clusterRow.getBoundingClientRect();
      if (rowRect.bottom > -100 && rowRect.top < window.innerHeight + 100) {
        const scrollImpulse = Math.max(-14, Math.min(14, deltaY * 0.18));
        velY += scrollImpulse;
        velX += (scrollImpulse * 0.25) * (Math.random() > 0.5 ? 0.6 : -0.6);
        wakeUp();
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateAnchors, { passive: true });

    updateAnchors();
    setTimeout(updateAnchors, 250);
    setTimeout(() => {
      velY = 4.2;
      wakeUp();
    }, 500);
  }

  // ── Golden Click Ripple (Hardware cursor companion) ─────────────────────
  function initClickRipple() {
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') return;
      const ripple = document.createElement('div');
      ripple.className = 'emittr-click-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);

      requestAnimationFrame(() => {
        ripple.classList.add('expanding');
      });

      setTimeout(() => {
        if (ripple.parentNode) ripple.remove();
      }, 500);
    }, { passive: true });
  }

  initPhysicalCable();
  initRelayDemo();
  initClickRipple();
})();
