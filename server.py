#!/usr/bin/env python3
"""
USB Typer & HID Deck Server  v1.1.0
====================================
Standalone daemon for rooted Android NetHunter devices.
Exposes REST + WebSocket endpoints to inject keystrokes and mouse events
directly into /dev/hidg0 using a unified composite HID Report Descriptor:
  - Report ID 1: Keyboard  (9 bytes: [1, mod, 0, key, 0, 0, 0, 0, 0])
  - Report ID 2: Mouse     (5 bytes: [2, buttons, dx, dy, wheel])

Served on 0.0.0.0:8088  (accessible as http://hid.keyboard or http://localhost:8088)
"""

import os
import sys
import time
import json
import asyncio
import subprocess
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("usb_typer")

VERSION = "1.1.0"

# ── HID Scancode Tables (Standard USB HID Boot Protocol) ────────────────────────
# Report format: [modifiers, reserved, key1, key2, key3, key4, key5, key6]

MOD_NONE   = 0x00
MOD_LCTRL  = 0x01
MOD_LSHIFT = 0x02
MOD_LALT   = 0x04
MOD_LGUI   = 0x08  # Windows / Super key
MOD_RCTRL  = 0x10
MOD_RSHIFT = 0x20
MOD_RALT   = 0x40
MOD_RGUI   = 0x80

# Mapping: char -> (modifier_byte, keycode_byte)
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
    # Digits 1-9, 0
    '1': (0, 0x1E), '2': (0, 0x1F), '3': (0, 0x20), '4': (0, 0x21),
    '5': (0, 0x22), '6': (0, 0x23), '7': (0, 0x24), '8': (0, 0x25),
    '9': (0, 0x26), '0': (0, 0x27),
    # Shifted symbols
    '!': (MOD_LSHIFT, 0x1E), '@': (MOD_LSHIFT, 0x1F), '#': (MOD_LSHIFT, 0x20),
    '$': (MOD_LSHIFT, 0x21), '%': (MOD_LSHIFT, 0x22), '^': (MOD_LSHIFT, 0x23),
    '&': (MOD_LSHIFT, 0x24), '*': (MOD_LSHIFT, 0x25), '(': (MOD_LSHIFT, 0x26),
    ')': (MOD_LSHIFT, 0x27),
    # Whitespace & Control
    '\n': (0, 0x28),  # Enter
    '\r': (0, 0x28),  # Return
    '\t': (0, 0x2B),  # Tab
    ' ':  (0, 0x2C),  # Space
    '\b': (0, 0x2A),  # Backspace
    # Punctuation
    '-': (0, 0x2D), '_': (MOD_LSHIFT, 0x2D),
    '=': (0, 0x2E), '+': (MOD_LSHIFT, 0x2E),
    '[': (0, 0x2F), '{': (MOD_LSHIFT, 0x2F),
    ']': (0, 0x30), '}': (MOD_LSHIFT, 0x30),
    '\\': (0, 0x31), '|': (MOD_LSHIFT, 0x31),
    ';': (0, 0x33), ':': (MOD_LSHIFT, 0x33),
    "'": (0, 0x34), '"': (MOD_LSHIFT, 0x34),
    '`': (0, 0x35), '~': (MOD_LSHIFT, 0x35),
    ',': (0, 0x36), '<': (MOD_LSHIFT, 0x36),
    '.': (0, 0x37), '>': (MOD_LSHIFT, 0x37),
    '/': (0, 0x38), '?': (MOD_LSHIFT, 0x38),
}

SPECIAL_KEYS: Dict[str, tuple] = {
    'enter':      (0, 0x28),
    'escape':     (0, 0x29),
    'esc':        (0, 0x29),
    'backspace':  (0, 0x2A),
    'tab':        (0, 0x2B),
    'space':      (0, 0x2C),
    'caps_lock':  (0, 0x39),
    'f1':         (0, 0x3A),
    'f2':         (0, 0x3B),
    'f3':         (0, 0x3C),
    'f4':         (0, 0x3D),
    'f5':         (0, 0x3E),
    'f6':         (0, 0x3F),
    'f7':         (0, 0x40),
    'f8':         (0, 0x41),
    'f9':         (0, 0x42),
    'f10':        (0, 0x43),
    'f11':        (0, 0x44),
    'f12':        (0, 0x45),
    'prtsc':      (0, 0x46),
    'scroll_lock':(0, 0x47),
    'pause':      (0, 0x48),
    'insert':     (0, 0x49),
    'home':       (0, 0x4A),
    'page_up':    (0, 0x4B),
    'pgup':       (0, 0x4B),
    'delete':     (0, 0x4C),
    'del':        (0, 0x4C),
    'end':        (0, 0x4D),
    'page_down':  (0, 0x4E),
    'pgdn':       (0, 0x4E),
    'right':      (0, 0x4F),
    'left':       (0, 0x50),
    'down':       (0, 0x51),
    'up':         (0, 0x52),
    'win':        (MOD_LGUI, 0),
    'super':      (MOD_LGUI, 0),
}

COMBOS: Dict[str, tuple] = {
    'win+r':         (MOD_LGUI, 0x15),
    'win+l':         (MOD_LGUI, 0x0F),
    'win+d':         (MOD_LGUI, 0x07),
    'win+e':         (MOD_LGUI, 0x08),
    'win+x':         (MOD_LGUI, 0x1B),
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
    'alt+tab':       (MOD_LALT, 0x2B),
    'alt+f4':        (MOD_LALT, 0x3D),
    'ctrl+alt+del':  (MOD_LCTRL | MOD_LALT, 0x4C),
}

# ── Hardware Device Controller ────────────────────────────────────────────────

import select

# Unified composite HID gadget: keyboard (Report ID 1) + mouse (Report ID 2)
HID_DEVICE_PATH = "/dev/hidg0"


class HIDDevice:
    def __init__(self, hid_path: str = HID_DEVICE_PATH):
        # FIX Bug 1: single hid_path replaces dead kbd_path + mouse_path pair
        self.hid_path = hid_path
        self.is_typing = False
        self.abort_requested = False

    def is_host_connected(self) -> bool:
        """Return True if the USB UDC is in 'configured' state (PC is polling)."""
        for p in Path("/sys/class/udc").glob("*"):
            st = p / "state"
            if st.exists():
                try:
                    return st.read_text().strip().lower() == "configured"
                except Exception:
                    pass
        # Fallback: HiSilicon-specific sysfs path (Honor/Huawei devices)
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
        if not self.is_host_connected():
            return False
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
        """Send keyboard null report (all keys up) — Report ID 1."""
        if not self.is_host_connected():
            return
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

    def press_and_release(self, mod: int, key: int, delay_s: float = 0.015):
        """Key down, hold for delay_s, then release."""
        self.write_kbd_report(mod, key)
        time.sleep(delay_s)
        self.release_keys()
        time.sleep(delay_s)

    def write_mouse_report(self, buttons: int, dx: int, dy: int, wheel: int = 0) -> bool:
        """Write 5-byte mouse report: [Report_ID=2, buttons, dx, dy, wheel]."""
        if not self.is_host_connected():
            return False
        fd = self._open_nonblock(self.hid_path)
        if fd is None:
            return False
        try:
            dx_c  = max(-127, min(127, dx))    & 0xFF
            dy_c  = max(-127, min(127, dy))    & 0xFF
            wh_c  = max(-127, min(127, wheel)) & 0xFF
            _, w, _ = select.select([], [fd], [], 0.05)
            if w:
                os.write(fd, bytes([2, buttons & 0x1F, dx_c, dy_c, wh_c]))
                return True
            return False
        except (BlockingIOError, OSError):
            return False
        finally:
            try:
                os.close(fd)
            except Exception:
                pass

    def get_usb_status(self) -> Dict[str, Any]:
        """Return USB connection state, UDC details, and HID node status."""
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

        is_connected = (state.lower() == "configured")
        # FIX Bug 4: single hid_node, consistent availability flag
        hid_ok = os.path.exists(self.hid_path) and os.access(self.hid_path, os.W_OK)

        return {
            "connected":       is_connected,
            "udc_state":       state,
            "speed":           speed,
            "udc":             udc_name,
            "hid_node":        self.hid_path,
            "hid_available":   hid_ok,
            # Legacy aliases so v1.0.0 clients still work
            "kbd_node":        self.hid_path,
            "kbd_available":   hid_ok,
            "mouse_node":      self.hid_path,
            "mouse_available": hid_ok,
            "is_typing":       self.is_typing,
            "version":         VERSION,
        }


hid = HIDDevice()

# ── Web Framework Setup ───────────────────────────────────────────────────────
try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Body
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse, JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
except ImportError:
    log.error("FastAPI or Uvicorn not installed. Run: pip3 install fastapi uvicorn")
    sys.exit(1)


# FIX Bug 3: use lifespan context manager — @app.on_event("startup") is deprecated
@asynccontextmanager
async def lifespan(application: "FastAPI"):
    # ── Startup ──────────────────────────────────────────────────────────────
    try:
        setup_script = Path(__file__).parent / "setup_gadget.py"
        if setup_script.exists():
            subprocess.run(
                [sys.executable, str(setup_script)],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
    except Exception as e:
        log.warning(f"Could not run setup_gadget: {e}")

    asyncio.create_task(connection_monitor_loop())
    asyncio.create_task(start_http_port80_redirector())
    log.info(f"USB Typer v{VERSION} started on port 8088.")
    yield
    # ── Shutdown (nothing to clean up) ───────────────────────────────────────


app = FastAPI(
    title="USB Typer Deck",
    version=VERSION,
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

connected_websockets: List[WebSocket] = []


async def broadcast_status(data: dict):
    """Push status JSON to all connected WebSocket clients, pruning dead ones."""
    dead = []
    msg  = json.dumps(data)
    for ws in connected_websockets:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.append(ws)
    for d in dead:
        if d in connected_websockets:
            connected_websockets.remove(d)


# ── REST API Endpoints ────────────────────────────────────────────────────────

@app.get("/")
async def get_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse({"status": "USB Typer Running", "version": VERSION})


@app.get("/api/status")
async def get_status():
    return hid.get_usb_status()


@app.post("/api/type")
async def type_text(data: dict = Body(...)):
    """Queue a text-typing job. Body: {text, delay_ms, initial_delay_s}"""
    if hid.is_typing:
        return JSONResponse({"ok": False, "msg": "Typing already in progress"}, status_code=409)
    text = data.get("text", "")
    if not text:
        return JSONResponse({"ok": False, "msg": "Empty text"}, status_code=400)
    delay_ms      = max(1, min(500, int(data.get("delay_ms", 15))))
    initial_delay = max(0, min(10,  float(data.get("initial_delay_s", 0))))
    asyncio.create_task(_type_worker(text, delay_ms / 1000.0, initial_delay))
    return {"ok": True, "msg": f"Typing {len(text)} characters", "chars": len(text)}


async def _type_worker(text: str, delay_s: float, initial_delay: float):
    hid.is_typing      = True
    hid.abort_requested = False
    await broadcast_status({"type": "typing_start", "total": len(text)})

    if initial_delay > 0:
        await asyncio.sleep(initial_delay)

    typed_count = 0
    # FIX Bug 2: get_running_loop() instead of deprecated get_event_loop()
    loop = asyncio.get_running_loop()

    def _sync_type():
        nonlocal typed_count
        for ch in text:
            if hid.abort_requested:
                break
            if ch in ASCII_MAP:
                mod, key = ASCII_MAP[ch]
                hid.press_and_release(mod, key, delay_s / 2.0)
            elif ch == '\n':
                hid.press_and_release(0, 0x28, delay_s / 2.0)
            elif ch == '\t':
                hid.press_and_release(0, 0x2B, delay_s / 2.0)
            typed_count += 1
            time.sleep(delay_s / 2.0)

    await loop.run_in_executor(None, _sync_type)
    hid.release_keys()
    aborted            = hid.abort_requested
    hid.is_typing      = False
    hid.abort_requested = False
    await broadcast_status({"type": "typing_end", "typed": typed_count,
                            "total": len(text), "aborted": aborted})


@app.post("/api/stop")
async def stop_typing():
    if hid.is_typing:
        hid.abort_requested = True
        hid.release_keys()
        return {"ok": True, "msg": "Abort signaled"}
    return {"ok": True, "msg": "No job active"}


@app.post("/api/key")
async def press_key(data: dict = Body(...)):
    """Inject a single key or shortcut. Body: {key} | {combo}"""
    combo = data.get("combo", "").lower().strip()
    key   = data.get("key",   "").lower().strip()
    if combo and combo in COMBOS:
        mod, code = COMBOS[combo]
        hid.press_and_release(mod, code, 0.015)
        return {"ok": True, "combo": combo}
    if key and key in SPECIAL_KEYS:
        mod, code = SPECIAL_KEYS[key]
        hid.press_and_release(mod, code, 0.015)
        return {"ok": True, "key": key}
    if key and len(key) == 1 and key in ASCII_MAP:
        mod, code = ASCII_MAP[key]
        hid.press_and_release(mod, code, 0.015)
        return {"ok": True, "char": key}
    return JSONResponse({"ok": False, "msg": f"Unknown: {combo or key}"}, status_code=400)


@app.post("/api/mouse")
async def mouse_action(data: dict = Body(...)):
    """Send mouse event. Body: {dx, dy, buttons, wheel}. buttons: 1=L 2=R 4=Mid"""
    dx      = int(data.get("dx",      0))
    dy      = int(data.get("dy",      0))
    buttons = int(data.get("buttons", 0))
    wheel   = int(data.get("wheel",   0))
    if buttons > 0 and dx == 0 and dy == 0 and wheel == 0:
        hid.write_mouse_report(buttons, 0, 0, 0)
        await asyncio.sleep(0.02)
        ok = hid.write_mouse_report(0, 0, 0, 0)
    else:
        ok = hid.write_mouse_report(buttons, dx, dy, wheel)
    return {"ok": ok}


# ── Live Keystroke WebSocket ───────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_websockets.append(ws)
    try:
        await ws.send_text(json.dumps({"type": "status", "data": hid.get_usb_status()}))
        while True:
            raw    = await ws.receive_text()
            data   = json.loads(raw)
            action = data.get("action")

            if action == "live_char":
                ch      = data.get("char", "")
                k_lower = ch.lower().strip()
                if ch in ASCII_MAP:
                    mod, code = ASCII_MAP[ch]
                    hid.press_and_release(mod, code, 0.015)
                elif k_lower in SPECIAL_KEYS:
                    mod, code = SPECIAL_KEYS[k_lower]
                    hid.press_and_release(mod, code, 0.015)
                elif k_lower in COMBOS:
                    mod, code = COMBOS[k_lower]
                    hid.press_and_release(mod, code, 0.015)
                else:
                    log.warning(f"Unmapped live_char: {ch!r}")

            elif action == "mouse_move":
                # FIX Bug 7 (partial): wheel now forwarded from client
                hid.write_mouse_report(
                    int(data.get("buttons", 0)),
                    int(data.get("dx", 0)),
                    int(data.get("dy", 0)),
                    int(data.get("wheel", 0)),
                )

            elif action == "mouse_click":
                btn = int(data.get("button", 1))
                hid.write_mouse_report(btn, 0, 0, 0)
                await asyncio.sleep(0.02)
                hid.write_mouse_report(0, 0, 0, 0)

            elif action == "get_status":
                await ws.send_text(json.dumps({"type": "status", "data": hid.get_usb_status()}))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        log.warning(f"WebSocket error: {e}")
    finally:
        if ws in connected_websockets:
            connected_websockets.remove(ws)


# Mount static files AFTER all routes
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


# ── Background Tasks ──────────────────────────────────────────────────────────

async def connection_monitor_loop():
    """Push UDC state changes to all connected clients every 2 s."""
    last_state = None
    while True:
        await asyncio.sleep(2.0)
        status  = hid.get_usb_status()
        current = (status["connected"], status["udc_state"])
        if current != last_state:
            last_state = current
            await broadcast_status({"type": "connection_change", "data": status})


async def start_http_port80_redirector():
    """Userland HTTP 302 redirect on port 80 -> port 8088.
    Avoids iptables NAT rules which deadlock Linux 4.4 when loopback traffic
    re-enters the networking stack while a mutex is held."""
    async def handle_port80(reader, writer):
        try:
            req_data = await asyncio.wait_for(reader.read(1024), timeout=2.0)
            lines = req_data.decode(errors="ignore").split("\r\n")
            host  = "hid.keyboard"
            for line in lines:
                if line.lower().startswith("host:"):
                    parts = line.split(":", 2)
                    if len(parts) >= 2:
                        host = parts[1].strip()
                    break
            resp = (
                f"HTTP/1.1 302 Found\r\n"
                f"Location: http://{host}:8088/\r\n"
                f"Connection: close\r\n"
                f"Content-Length: 0\r\n\r\n"
            )
            writer.write(resp.encode())
            await writer.drain()
        except Exception:
            pass
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    try:
        server = await asyncio.start_server(handle_port80, "0.0.0.0", 80)
        log.info("Port 80 redirector active -> port 8088")
        asyncio.create_task(server.serve_forever())
    except Exception as e:
        log.warning(f"Could not bind port 80 (non-fatal): {e}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8088))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
