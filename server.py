#!/usr/bin/env python3
"""
server.py  —  Emittr Backend & HID Controller  v1.3.0
=====================================================
FastAPI server running on Android NetHunter (port 8088).
Provides:
  - Web UI serving (PWA / Responsive) with strict anti-caching headers
  - REST & WebSocket endpoints for USB keystrokes & mouse control
  - Native dual-axis mouse scrolling (Vertical Wheel + AC Pan Horizontal Scroll)
  - Keyboard mirror & typing queues
  - Automatic USB watchdog (prevents mass_storage reversion)
  - Emergency unstick release mechanism (flushes all keys & mouse buttons)
  - Port 80 -> 8088 redirector
  - Shared-secret token auth on all mutating endpoints (REST + WebSocket)
"""

import asyncio
import json
import logging
import logging.handlers
import os
import re
import secrets
import select
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import Body, Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

_log_handlers = [logging.StreamHandler(sys.stdout)]
try:
    # Bounded rotating log file (5MB x 3 backups) so /var/log/usb_deck.log can't grow unbounded.
    _log_handlers.append(
        logging.handlers.RotatingFileHandler(
            "/var/log/usb_deck.log", maxBytes=5 * 1024 * 1024, backupCount=3
        )
    )
except Exception:
    pass  # Path may be unwritable outside the target device — stdout logging still works.

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=_log_handlers,
    force=True,
)
log = logging.getLogger("emittr")

VERSION = "1.3.0"
MAX_TEXT_LENGTH = 50_000  # Guard against unbounded /api/type payloads
LIVE_CHAR_MIN_INTERVAL = 0.003  # ~330/s ceiling per WebSocket client on live_char

# ── Auth Token ──────────────────────────────────────────────────────────────
# A per-install shared secret is required on every mutating REST/WS call.
# It's generated once, persisted next to this file, and embedded into the
# served index.html so the legitimate web UI can read it — third parties on
# the same network never see it unless they already have page access.
TOKEN_FILE = Path(__file__).parent / ".emittr_token"


def _load_or_create_token() -> str:
    try:
        if TOKEN_FILE.exists():
            existing = TOKEN_FILE.read_text(encoding="utf-8").strip()
            if existing:
                return existing
        token = secrets.token_urlsafe(24)
        TOKEN_FILE.write_text(token, encoding="utf-8")
        try:
            os.chmod(TOKEN_FILE, 0o600)
        except Exception:
            pass
        return token
    except Exception as e:
        log.warning(f"Could not persist auth token ({e}); using in-memory token for this run.")
        return secrets.token_urlsafe(24)


AUTH_TOKEN = _load_or_create_token()


def check_token(supplied: Optional[str]) -> bool:
    return bool(supplied) and secrets.compare_digest(supplied, AUTH_TOKEN)


async def verify_token(x_emittr_token: str = Header(default="")):
    """FastAPI dependency: reject mutating requests that don't carry the shared token."""
    if not check_token(x_emittr_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

# ── HID Scancode Tables (Standard USB HID Boot Protocol) ───────────────────
MOD_NONE   = 0x00
MOD_LCTRL  = 0x01
MOD_LSHIFT = 0x02
MOD_LALT   = 0x04
MOD_LGUI   = 0x08
MOD_RCTRL  = 0x10
MOD_RSHIFT = 0x20
MOD_RALT   = 0x40
MOD_RGUI   = 0x80

ASCII_MAP: Dict[str, tuple] = {
    # Lowercase a-z
    'a': (0, 0x04), 'b': (0, 0x05), 'c': (0, 0x06), 'd': (0, 0x07),
    'e': (0, 0x08), 'f': (0, 0x09), 'g': (0, 0x0A), 'h': (0, 0x0B),
    'i': (0, 0x0C), 'j': (0, 0x0D), 'k': (0, 0x0E), 'l': (0, 0x0F),
    'm': (0, 0x10), 'n': (0, 0x11), 'o': (0, 0x12), 'p': (0, 0x13),
    'q': (0, 0x14), 'r': (0, 0x15), 's': (0, 0x16), 't': (0, 0x17),
    'u': (0, 0x18), 'v': (0, 0x19), 'w': (0, 0x1A), 'x': (0, 0x1B),
    'y': (0, 0x1C), 'z': (0, 0x1D),
    # Uppercase A-Z (Shift)
    'A': (MOD_LSHIFT, 0x04), 'B': (MOD_LSHIFT, 0x05), 'C': (MOD_LSHIFT, 0x06),
    'D': (MOD_LSHIFT, 0x07), 'E': (MOD_LSHIFT, 0x08), 'F': (MOD_LSHIFT, 0x09),
    'G': (MOD_LSHIFT, 0x0A), 'H': (MOD_LSHIFT, 0x0B), 'I': (MOD_LSHIFT, 0x0C),
    'J': (MOD_LSHIFT, 0x0D), 'K': (MOD_LSHIFT, 0x0E), 'L': (MOD_LSHIFT, 0x0F),
    'M': (MOD_LSHIFT, 0x10), 'N': (MOD_LSHIFT, 0x11), 'O': (MOD_LSHIFT, 0x12),
    'P': (MOD_LSHIFT, 0x13), 'Q': (MOD_LSHIFT, 0x14), 'R': (MOD_LSHIFT, 0x15),
    'S': (MOD_LSHIFT, 0x16), 'T': (MOD_LSHIFT, 0x17), 'U': (MOD_LSHIFT, 0x18),
    'V': (MOD_LSHIFT, 0x19), 'W': (MOD_LSHIFT, 0x1A), 'X': (MOD_LSHIFT, 0x1B),
    'Y': (MOD_LSHIFT, 0x1C), 'Z': (MOD_LSHIFT, 0x1D),
    # Numbers
    '1': (0, 0x1E), '2': (0, 0x1F), '3': (0, 0x20), '4': (0, 0x21),
    '5': (0, 0x22), '6': (0, 0x23), '7': (0, 0x24), '8': (0, 0x25),
    '9': (0, 0x26), '0': (0, 0x27),
    # Symbols (top row with Shift)
    '!': (MOD_LSHIFT, 0x1E), '@': (MOD_LSHIFT, 0x1F), '#': (MOD_LSHIFT, 0x20),
    '$': (MOD_LSHIFT, 0x21), '%': (MOD_LSHIFT, 0x22), '^': (MOD_LSHIFT, 0x23),
    '&': (MOD_LSHIFT, 0x24), '*': (MOD_LSHIFT, 0x25), '(': (MOD_LSHIFT, 0x26),
    ')': (MOD_LSHIFT, 0x27),
    # Whitespace & Control
    '\n': (0, 0x28), '\r': (0, 0x28), '\t': (0, 0x2B), ' ':  (0, 0x2C),
    # Punctuation & symbols (unshifted)
    '-': (0, 0x2D), '=': (0, 0x2E), '[': (0, 0x2F), ']': (0, 0x30),
    '\\': (0, 0x31), ';': (0, 0x33), "'": (0, 0x34), '`': (0, 0x35),
    ',': (0, 0x36), '.': (0, 0x37), '/': (0, 0x38),
    # Punctuation & symbols (shifted)
    '_': (MOD_LSHIFT, 0x2D), '+': (MOD_LSHIFT, 0x2E), '{': (MOD_LSHIFT, 0x2F),
    '}': (MOD_LSHIFT, 0x30), '|': (MOD_LSHIFT, 0x31), ':': (MOD_LSHIFT, 0x33),
    '"': (MOD_LSHIFT, 0x34), '~': (MOD_LSHIFT, 0x35), '<': (MOD_LSHIFT, 0x36),
    '>': (MOD_LSHIFT, 0x37), '?': (MOD_LSHIFT, 0x38),
}

SPECIAL_KEYS: Dict[str, tuple] = {
    'enter':       (0, 0x28),
    'return':      (0, 0x28),
    'esc':         (0, 0x29),
    'escape':      (0, 0x29),
    'backspace':   (0, 0x2A),
    'tab':         (0, 0x2B),
    'space':       (0, 0x2C),
    'capslock':    (0, 0x39),
    'f1':          (0, 0x3A),
    'f2':          (0, 0x3B),
    'f3':          (0, 0x3C),
    'f4':          (0, 0x3D),
    'f5':          (0, 0x3E),
    'f6':          (0, 0x3F),
    'f7':          (0, 0x40),
    'f8':          (0, 0x41),
    'f9':          (0, 0x42),
    'f10':         (0, 0x43),
    'f11':         (0, 0x44),
    'f12':         (0, 0x45),
    'printscreen': (0, 0x46),
    'scrolllock':  (0, 0x47),
    'pause':       (0, 0x48),
    'insert':      (0, 0x49),
    'home':        (0, 0x4A),
    'pageup':      (0, 0x4B),
    'delete':      (0, 0x4C),
    'end':         (0, 0x4D),
    'pagedown':    (0, 0x4E),
    'right':       (0, 0x4F),
    'left':        (0, 0x50),
    'down':        (0, 0x51),
    'up':          (0, 0x52),
    'arrowright':  (0, 0x4F),
    'arrowleft':   (0, 0x50),
    'arrowdown':   (0, 0x51),
    'arrowup':     (0, 0x52),
    'numlock':     (0, 0x53),
}

COMBOS: Dict[str, tuple] = {
    'win+r':         (MOD_LGUI, 0x15),
    'win+l':         (MOD_LGUI, 0x0F),
    'win+d':         (MOD_LGUI, 0x07),
    'win+e':         (MOD_LGUI, 0x08),
    'win+x':         (MOD_LGUI, 0x1B),
    'win+s':         (MOD_LGUI, 0x16),
    'alt+tab':       (MOD_LALT, 0x2B),
    'alt+f4':        (MOD_LALT, 0x3D),
    'ctrl+c':        (MOD_LCTRL, 0x06),
    'ctrl+v':        (MOD_LCTRL, 0x19),
    'ctrl+x':        (MOD_LCTRL, 0x1B),
    'ctrl+a':        (MOD_LCTRL, 0x04),
    'ctrl+z':        (MOD_LCTRL, 0x1D),
    'ctrl+y':        (MOD_LCTRL, 0x1C),
    'ctrl+s':        (MOD_LCTRL, 0x16),
    'ctrl+w':        (MOD_LCTRL, 0x1A),
    'ctrl+t':        (MOD_LCTRL, 0x17),
    'ctrl+shift+esc':(MOD_LCTRL | MOD_LSHIFT, 0x29),
    'ctrl+alt+del':  (MOD_LCTRL | MOD_LALT, 0x4C),
    'ctrl+left':     (MOD_LCTRL, 0x50),
    'ctrl+right':    (MOD_LCTRL, 0x4F),
    'ctrl+up':       (MOD_LCTRL, 0x52),
    'ctrl+down':     (MOD_LCTRL, 0x51),
    'shift+left':    (MOD_LSHIFT, 0x50),
    'shift+right':   (MOD_LSHIFT, 0x4F),
    'shift+up':      (MOD_LSHIFT, 0x52),
    'shift+down':    (MOD_LSHIFT, 0x51),
    'alt+left':      (MOD_LALT, 0x50),
    'alt+right':     (MOD_LALT, 0x4F),
}

HID_DEVICE_PATH = "/dev/hidg0"
PORT = int(os.environ.get("EMITTR_PORT", "8088"))


class HIDDevice:
    def __init__(self, hid_path: str = HID_DEVICE_PATH):
        self.hid_path = hid_path
        self.is_typing = False
        self.abort_requested = False

    def is_host_connected(self) -> bool:
        """Return True if USB UDC is in 'configured' state."""
        for p in Path("/sys/class/udc").glob("*"):
            st = p / "state"
            if st.exists():
                try:
                    return st.read_text().strip().lower() == "configured"
                except Exception:
                    pass
        udc_hisi = Path("/sys/devices/hisi-usb-otg/udc/hisi-usb-otg/state")
        if udc_hisi.exists():
            try:
                return udc_hisi.read_text().strip().lower() == "configured"
            except Exception:
                pass
        return False

    def _open_nonblock(self, path: str):
        if not os.path.exists(path):
            return None
        try:
            return os.open(path, os.O_WRONLY | os.O_NONBLOCK)
        except Exception:
            return None

    def write_kbd_report(self, mod: int, key: int) -> bool:
        """Write 9-byte keyboard report: [Report_ID=1, mod, 0, key, 0, 0, 0, 0, 0]."""
        fd = self._open_nonblock(self.hid_path)
        if fd is None:
            return False
        try:
            _, w, _ = select.select([], [fd], [], 0.05)
            if w:
                os.write(fd, bytes([1, mod, 0, key, 0, 0, 0, 0, 0]))
                return True
            return False
        except (BlockingIOError, OSError):
            return False
        finally:
            try:
                os.close(fd)
            except Exception:
                pass

    def release_keys(self):
        """Send keyboard null report (all keys released) — Report ID 1."""
        fd = self._open_nonblock(self.hid_path)
        if fd is None:
            return
        try:
            _, w, _ = select.select([], [fd], [], 0.05)
            if w:
                os.write(fd, bytes([1, 0, 0, 0, 0, 0, 0, 0, 0]))
        except Exception:
            pass
        finally:
            try:
                os.close(fd)
            except Exception:
                pass

    def release_mouse(self):
        """Send mouse null report (all buttons & deltas zeroed) — Report ID 2 (6 bytes)."""
        fd = self._open_nonblock(self.hid_path)
        if fd is None:
            return
        try:
            _, w, _ = select.select([], [fd], [], 0.05)
            if w:
                os.write(fd, bytes([2, 0, 0, 0, 0, 0]))
        except Exception:
            pass
        finally:
            try:
                os.close(fd)
            except Exception:
                pass

    def release_all(self):
        """Emergency unstick: clears all keyboard modifiers, keys, and mouse buttons."""
        self.release_keys()
        self.release_mouse()

    def press_and_release(self, mod: int, key: int, delay_s: float = 0.015):
        """Key down, hold for delay_s, then release. Wrapped in try/finally to prevent stuck keys."""
        try:
            self.write_kbd_report(mod, key)
        finally:
            # Floor scales with the requested delay so "Instant" presets aren't
            # silently clamped to the old fixed ~20ms/char minimum.
            time.sleep(max(0.004, min(delay_s, 0.012)))
            self.release_keys()
            time.sleep(0.003)

    def write_mouse_report(self, buttons: int, dx: int, dy: int, wheel: int = 0, pan: int = 0) -> bool:
        """
        Write 6-byte mouse report: [Report_ID=2, buttons, dx, dy, wheel, pan].
        pan: AC Pan (Consumer Usage 0x0238) for native horizontal scrolling.
        """
        fd = self._open_nonblock(self.hid_path)
        if fd is None:
            return False
        try:
            dx_c  = max(-127, min(127, dx))    & 0xFF
            dy_c  = max(-127, min(127, dy))    & 0xFF
            wh_c  = max(-127, min(127, wheel)) & 0xFF
            pan_c = max(-127, min(127, pan))   & 0xFF
            _, w, _ = select.select([], [fd], [], 0.05)
            if w:
                os.write(fd, bytes([2, buttons & 0x1F, dx_c, dy_c, wh_c, pan_c]))
                return True
            return False
        except (BlockingIOError, OSError):
            return False
        finally:
            try:
                os.close(fd)
            except Exception:
                pass

    def write_scroll(self, wheel_v: int = 0, wheel_h: int = 0) -> bool:
        """
        Handle vertical and horizontal scrolling natively.
        wheel_v: vertical ticks (positive = up, negative = down)
        wheel_h: horizontal ticks (positive = right, negative = left)
        Uses native HID AC Pan (Usage 0x0238) for hardware horizontal scroll (WM_MOUSEHWHEEL).
        """
        ok = self.write_mouse_report(0, 0, 0, wheel=wheel_v, pan=wheel_h)
        if ok and (wheel_v != 0 or wheel_h != 0):
            try:
                time.sleep(0.005)
                self.release_mouse()
            except Exception:
                pass
        return ok

    def get_usb_status(self) -> Dict[str, Any]:
        """Return USB connection state, UDC details, version, and HID node status."""
        state    = "not attached"
        speed    = "unknown"
        udc_name = "unknown"

        for p in Path("/sys/class/udc").glob("*"):
            st = p / "state"
            if st.exists():
                try:
                    state = st.read_text().strip()
                except Exception:
                    pass
            sp = p / "current_speed"
            if sp.exists():
                try:
                    speed = sp.read_text().strip()
                except Exception:
                    pass
            udc_name = p.name
            break

        if state == "not attached":
            udc_hisi = Path("/sys/devices/hisi-usb-otg/udc/hisi-usb-otg/state")
            if udc_hisi.exists():
                try:
                    state = udc_hisi.read_text().strip()
                    udc_name = "hisi-usb-otg"
                except Exception:
                    pass

        return {
            "attached":        state.lower() in ("configured", "addressed"),
            "state":           state,
            "speed":           speed,
            "udc":             udc_name,
            "hid_node_exists": os.path.exists(self.hid_path),
            "is_typing":       self.is_typing,
            "version":         VERSION,
        }


hid = HIDDevice()
connected_websockets: List[WebSocket] = []
current_typing_task: Optional[asyncio.Task] = None
stop_event = asyncio.Event()
typing_lock = asyncio.Lock()  # Serializes /api/type job start against concurrent requests

STATIC_DIR = Path(__file__).parent / "static"

# ── HID Mode (manual toggle) ────────────────────────────────────────────────
# Whether Emittr is allowed to claim/hold the USB gadget as HID. This defers to
# NetHunter's own USB-function switch by default: Emittr stays hands-off until the
# user explicitly opts in from Settings, instead of silently claiming the UDC on
# every boot. Toggling it off releases the UDC so NetHunter (or any other app) can
# take over USB function selection; toggling it on hands control back to Emittr.
HID_MODE_FILE = Path(__file__).parent / ".emittr_hid_mode"


def _load_hid_mode() -> bool:
    try:
        if HID_MODE_FILE.exists():
            return HID_MODE_FILE.read_text(encoding="utf-8").strip() == "1"
    except Exception:
        pass
    return False  # default off: let NetHunter's own USB-function choice stand until opted in


def _save_hid_mode(enabled: bool):
    try:
        HID_MODE_FILE.write_text("1" if enabled else "0", encoding="utf-8")
    except Exception as e:
        log.warning(f"Could not persist HID mode setting: {e}")


hid_mode_enabled = _load_hid_mode()


def ensure_hid_gadget():
    """Verify composite HID gadget is active. If Android reverted to mass_storage, restore it."""
    gadget_dir = "/config/usb_gadget/g1"
    if not os.path.exists(gadget_dir):
        return
    cfg_f1 = f"{gadget_dir}/configs/b.1/f1"
    if not os.path.exists(cfg_f1):
        log.info("Detected USB configuration reversion. Restoring composite HID gadget...")
        try:
            import setup_gadget
            setup_gadget.init_gadget()
        except Exception as e:
            log.error(f"Failed to restore gadget: {e}")


def release_hid_gadget():
    """Unbind the UDC so another USB function (e.g. one picked in NetHunter) can claim it."""
    udc_file = "/config/usb_gadget/g1/UDC"
    try:
        if os.path.exists(udc_file):
            with open(udc_file, "w") as f:
                f.write("none\n")
            log.info("HID gadget released; UDC freed for other USB functions.")
    except Exception as e:
        log.warning(f"Could not release HID gadget UDC: {e}")


def get_status_payload() -> Dict[str, Any]:
    """USB status plus the current authenticated WebSocket client count."""
    payload = hid.get_usb_status()
    payload["clients"] = len(connected_websockets)
    payload["hid_mode_enabled"] = hid_mode_enabled
    return payload


async def lifespan(application: "FastAPI"):
    # Startup: ensure gadget is bound (only if HID mode is enabled) and flush releases
    if hid_mode_enabled:
        ensure_hid_gadget()
    hid.release_all()

    asyncio.create_task(connection_monitor_loop())
    asyncio.create_task(start_http_port80_redirector())
    log.info(f"Emittr Server v{VERSION} initialized on port {PORT}.")

    yield

    # Shutdown: clean release
    hid.release_all()


app = FastAPI(title="Emittr", version=VERSION, lifespan=lifespan)


# ── Middleware: Prevent Mobile Browser Asset Caching ────────────────────────
@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.startswith("/static/") or path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


async def broadcast_status(data: dict):
    if not connected_websockets:
        return
    msg = json.dumps(data)
    dead = []
    for ws in connected_websockets:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in connected_websockets:
            connected_websockets.remove(ws)


# ── REST API Routes ────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def get_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        html = index_file.read_text(encoding="utf-8")
        # Embed the shared auth token for the legitimate web UI to attach to its own requests.
        token_script = f'<script>window.EMITTR_TOKEN="{AUTH_TOKEN}";</script>'
        html = html.replace("<head>", "<head>\n  " + token_script, 1)
        return HTMLResponse(
            content=html,
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )
    return HTMLResponse("<h1>Emittr static assets missing</h1>", status_code=404)


@app.get("/api/status")
async def get_status():
    return get_status_payload()


@app.post("/api/release", dependencies=[Depends(verify_token)])
async def emergency_release():
    """Emergency unstick endpoint: release all modifier keys and mouse buttons."""
    hid.release_all()
    return {"ok": True, "msg": "All keys and mouse buttons released"}


@app.post("/api/hid_mode", dependencies=[Depends(verify_token)])
async def set_hid_mode(data: dict = Body(...)):
    """Manually enable/disable USB HID mode. Mirrors NetHunter's own USB-function switch:
    a persisted, user-controlled setting instead of Emittr silently re-claiming the UDC."""
    global hid_mode_enabled
    enabled = bool(data.get("enabled", True))
    hid_mode_enabled = enabled
    _save_hid_mode(enabled)
    loop = asyncio.get_event_loop()

    if enabled:
        try:
            import setup_gadget
            ok = await loop.run_in_executor(None, lambda: setup_gadget.init_gadget(force=True))
        except Exception as e:
            log.error(f"Failed to enable HID gadget: {e}")
            ok = False
        msg = "HID mode enabled" if ok else "Failed to bind HID gadget (check logs)"
        return {"ok": ok, "hid_mode_enabled": True, "msg": msg}

    await loop.run_in_executor(None, release_hid_gadget)
    return {"ok": True, "hid_mode_enabled": False, "msg": "HID mode released — you can now switch USB function from NetHunter"}


@app.post("/api/type", dependencies=[Depends(verify_token)])
async def type_text(data: dict = Body(...)):
    global current_typing_task
    text          = data.get("text", "")
    delay_ms      = float(data.get("delay_ms", 15))
    initial_delay = float(data.get("initial_delay_s", 0))

    if not text:
        return JSONResponse({"ok": False, "msg": "No text provided"}, status_code=400)

    if len(text) > MAX_TEXT_LENGTH:
        return JSONResponse(
            {"ok": False, "msg": f"Text exceeds max length of {MAX_TEXT_LENGTH} characters"},
            status_code=413,
        )

    # Atomically check-and-set under a lock so two concurrent requests can't both
    # slip past the busy check and interleave keystrokes on /dev/hidg0.
    async with typing_lock:
        if hid.is_typing:
            return JSONResponse({"ok": False, "msg": "Another typing job is in progress"}, status_code=409)
        hid.is_typing = True

    delay_s = max(0.001, delay_ms / 1000.0)
    current_typing_task = asyncio.create_task(_type_worker(text, delay_s, initial_delay))
    current_typing_task.add_done_callback(_on_typing_task_done)
    return {"ok": True, "length": len(text), "delay_ms": delay_ms}


def _on_typing_task_done(task: asyncio.Task):
    """Surface otherwise-silent exceptions from the fire-and-forget typing task."""
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        log.error(f"Typing task failed: {exc}")
        hid.is_typing = False
        asyncio.create_task(broadcast_status({"type": "typing_error", "msg": str(exc)}))


async def _type_worker(text: str, delay_s: float, initial_delay: float):
    # hid.is_typing is already set True by the caller under typing_lock.
    stop_event.clear()
    total = len(text)
    await broadcast_status({"type": "typing_start", "total": total})

    if initial_delay > 0:
        for remaining in range(int(initial_delay), 0, -1):
            if stop_event.is_set():
                break
            await broadcast_status({"type": "countdown", "remaining": remaining})
            await asyncio.sleep(1.0)

    def _sync_type():
        for ch in text:
            if stop_event.is_set():
                break
            if ch in ASCII_MAP:
                mod, code = ASCII_MAP[ch]
                hid.press_and_release(mod, code, delay_s)
            else:
                log.warning(f"Unmapped character in text: {ch!r} (ASCII {ord(ch)})")

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _sync_type)
    finally:
        hid.release_keys()
        hid.is_typing = False
        await broadcast_status({"type": "typing_end", "aborted": stop_event.is_set()})


@app.post("/api/stop", dependencies=[Depends(verify_token)])
async def stop_typing():
    if not hid.is_typing:
        return {"ok": True, "msg": "Not typing"}
    stop_event.set()
    hid.release_all()
    return {"ok": True, "msg": "Typing stopped"}


@app.post("/api/key", dependencies=[Depends(verify_token)])
async def press_key(data: dict = Body(...)):
    combo = data.get("combo", "").lower().strip()
    key   = data.get("key",   "").lower().strip()
    loop  = asyncio.get_event_loop()
    if combo and combo in COMBOS:
        mod, code = COMBOS[combo]
        await loop.run_in_executor(None, hid.press_and_release, mod, code, 0.015)
        return {"ok": True, "combo": combo}
    if key and key in SPECIAL_KEYS:
        mod, code = SPECIAL_KEYS[key]
        await loop.run_in_executor(None, hid.press_and_release, mod, code, 0.015)
        return {"ok": True, "key": key}
    if key and len(key) == 1 and key in ASCII_MAP:
        mod, code = ASCII_MAP[key]
        await loop.run_in_executor(None, hid.press_and_release, mod, code, 0.015)
        return {"ok": True, "char": key}
    return JSONResponse({"ok": False, "msg": f"Unknown: {combo or key}"}, status_code=400)


@app.post("/api/mouse", dependencies=[Depends(verify_token)])
async def mouse_action(data: dict = Body(...)):
    """Send mouse event. Body: {dx, dy, buttons, wheel, wheel_h, pan, click}"""
    dx      = int(data.get("dx",      0))
    dy      = int(data.get("dy",      0))
    buttons = int(data.get("buttons", 0))
    wheel   = int(data.get("wheel",   0))
    wheel_h = int(data.get("wheel_h", data.get("pan", 0)))
    click   = bool(data.get("click",  False))

    if wheel != 0 or wheel_h != 0:
        ok = hid.write_scroll(wheel_v=wheel, wheel_h=wheel_h)
        return {"ok": ok}

    if click:
        btn = buttons if buttons else 1
        hid.write_mouse_report(btn, 0, 0, 0, 0)
        await asyncio.sleep(0.02)
        ok = hid.write_mouse_report(0, 0, 0, 0, 0)
    else:
        ok = hid.write_mouse_report(buttons, dx, dy, wheel, wheel_h)
    return {"ok": ok}


# ── Live Keystroke & Mouse WebSocket ───────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    token = ws.query_params.get("token", "")
    if not check_token(token):
        await ws.close(code=4401)
        return

    await ws.accept()
    connected_websockets.append(ws)
    loop = asyncio.get_event_loop()
    last_live_char_ts = 0.0
    try:
        await ws.send_text(json.dumps({"type": "status", "data": get_status_payload()}))
        while True:
            raw    = await ws.receive_text()
            data   = json.loads(raw)
            action = data.get("action")

            if action == "release_all":
                await loop.run_in_executor(None, hid.release_all)
                await ws.send_text(json.dumps({"type": "released", "ok": True}))

            elif action == "live_char":
                # Simple per-connection throttle to prevent flooding the HID pipe.
                now = time.monotonic()
                if now - last_live_char_ts < LIVE_CHAR_MIN_INTERVAL:
                    continue
                last_live_char_ts = now

                ch      = data.get("char", "")
                k_lower = ch.lower().strip()
                if ch in ASCII_MAP:
                    mod, code = ASCII_MAP[ch]
                    await loop.run_in_executor(None, hid.press_and_release, mod, code, 0.015)
                elif k_lower in SPECIAL_KEYS:
                    mod, code = SPECIAL_KEYS[k_lower]
                    await loop.run_in_executor(None, hid.press_and_release, mod, code, 0.015)
                elif k_lower in COMBOS:
                    mod, code = COMBOS[k_lower]
                    await loop.run_in_executor(None, hid.press_and_release, mod, code, 0.015)
                else:
                    log.warning(f"Unmapped live_char: {ch!r}")

            elif action == "mouse_scroll":
                wv = int(data.get("wheel_v", data.get("wheel", 0)))
                wh = int(data.get("wheel_h", data.get("pan", 0)))
                await loop.run_in_executor(None, hid.write_scroll, wv, wh)

            elif action == "mouse_move":
                btn     = int(data.get("buttons", 0))
                dx      = int(data.get("dx", 0))
                dy      = int(data.get("dy", 0))
                wheel   = int(data.get("wheel", 0))
                wheel_h = int(data.get("wheel_h", data.get("pan", 0)))

                if wheel != 0 or wheel_h != 0:
                    await loop.run_in_executor(None, hid.write_scroll, wheel, wheel_h)
                else:
                    await loop.run_in_executor(None, hid.write_mouse_report, btn, dx, dy, 0, 0)

            elif action == "mouse_click":
                btn = int(data.get("button", 1))
                await loop.run_in_executor(None, hid.write_mouse_report, btn, 0, 0, 0, 0)
                await asyncio.sleep(0.02)
                await loop.run_in_executor(None, hid.write_mouse_report, 0, 0, 0, 0, 0)

            elif action == "get_status":
                await ws.send_text(json.dumps({"type": "status", "data": get_status_payload()}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.warning(f"WebSocket error: {e}")
    finally:
        if ws in connected_websockets:
            connected_websockets.remove(ws)


# Mount static files AFTER all routes
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ── Background Tasks ───────────────────────────────────────────────────────

async def connection_monitor_loop():
    """
    Monitors USB state every 1.5 seconds:
      1. Prevents Android NetHunter mass_storage hijacking by restoring HID gadget.
      2. Automatically flushes zero reports when PC attaches to clear any stuck keys.
      3. Broadcasts state changes to all connected clients.
    """
    last_state = None
    loop = asyncio.get_event_loop()
    while True:
        await asyncio.sleep(1.5)
        try:
            # ensure_hid_gadget() does blocking filesystem I/O; keep it off the event loop.
            # Only auto-restore while HID mode is enabled — when disabled, Emittr must not
            # fight whatever USB function the user picked elsewhere (e.g. via NetHunter).
            if hid_mode_enabled:
                await loop.run_in_executor(None, ensure_hid_gadget)
            st = await loop.run_in_executor(None, hid.get_usb_status)
            current_state = st.get("attached", False)

            # Detect transition from not-attached -> attached (PC plugged in or rebooted)
            if last_state is not None and not last_state and current_state:
                log.info("PC attached! Flushing zero report to unstick any rogue keys...")
                await loop.run_in_executor(None, hid.release_all)

            last_state = current_state
            st["clients"] = len(connected_websockets)
            await broadcast_status({"type": "status", "data": st})
        except Exception as e:
            log.warning(f"Connection monitor exception: {e}")


# A conservative hostname/IPv4 matcher used to validate the client-supplied Host header
# before echoing it back in a redirect (prevents header-injection / open-redirect abuse).
_SAFE_HOST_RE = re.compile(r"^[A-Za-z0-9.\-]{1,253}$")


async def start_http_port80_redirector():
    """Userland HTTP 302 redirect on port 80 -> the configured app port."""
    async def handle_port80(reader, writer):
        try:
            req_data = await asyncio.wait_for(reader.read(1024), timeout=2.0)
            host_header = "hid.keyboard"
            for line in req_data.decode("utf-8", errors="ignore").split("\r\n"):
                if line.lower().startswith("host:"):
                    candidate = line.split(":", 1)[1].strip().split(":")[0]
                    # Reject anything that isn't a plausible hostname/IP to avoid
                    # reflecting attacker-controlled values into the Location header.
                    if _SAFE_HOST_RE.match(candidate):
                        host_header = candidate
                    break
            redirect_response = (
                "HTTP/1.1 302 Found\r\n"
                f"Location: http://{host_header}:{PORT}/\r\n"
                "Connection: close\r\n"
                "Content-Length: 0\r\n\r\n"
            )
            writer.write(redirect_response.encode())
            await writer.drain()
        except Exception:
            pass
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    try:
        server = await asyncio.start_server(handle_port80, "0.0.0.0", 80)
        log.info(f"Port 80 redirector listening (redirects to :{PORT})")
        async with server:
            await server.serve_forever()
    except Exception as e:
        log.warning(f"Port 80 redirector could not bind: {e}")


if __name__ == "__main__":
    import uvicorn

    # Default preserves existing LAN-accessible behavior; set EMITTR_HOST=127.0.0.1
    # to restrict to the device itself. Optional TLS via EMITTR_SSL_CERT/EMITTR_SSL_KEY.
    bind_host = os.environ.get("EMITTR_HOST", "0.0.0.0")
    ssl_cert  = os.environ.get("EMITTR_SSL_CERT")
    ssl_key   = os.environ.get("EMITTR_SSL_KEY")
    uvicorn.run(
        "server:app",
        host=bind_host,
        port=PORT,
        reload=False,
        access_log=False,
        ssl_certfile=ssl_cert if ssl_cert and ssl_key else None,
        ssl_keyfile=ssl_key if ssl_cert and ssl_key else None,
    )