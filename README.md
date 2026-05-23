# USB Typer & HID Deck ⌨️ 🖱️

> **Turn your rooted Android phone into a high-performance USB HID Keyboard & Trackpad with a clean, modern Material Design 3 Web App.**

[![Release](https://img.shields.io/badge/release-v1.0.0-blue.svg)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-teal.svg)](https://fastapi.tiangolo.com/)

USB Typer transforms an Android device (running Kali NetHunter or any Linux chroot with kernel USB gadget support) into a fully functional hardware USB HID Keyboard and Mouse for any connected PC, Mac, Linux machine, or game console.

---

## ✨ Features

- 📱 **Installable Progressive Web App (PWA)**:
  - Material Design 3 mobile UI styled after the Android Clock app.
  - Installable directly to your home screen (`Add to Home Screen`) for a full-screen, native-app feel.
  - Supports both Dark Mode and Light Mode.
- ⚡ **Instant Live Keyboard Mirroring**:
  - Open your phone's native keyboard (SwiftKey, Gboard, Samsung Keyboard, etc.).
  - Universal input diffing engine forwards every keystroke live over WebSocket with sub-5ms latency.
  - Hardware helper keys for `Enter ↵`, `Space ␣`, `Tab ⇥`, `Backspace ⌫`, and `Esc`.
- 📝 **Bulk Text Typer**:
  - Type or paste long text, scripts, or URLs to type automatically onto the PC.
  - Customizable typing speed (Instant 5ms, Fast 15ms, Normal 35ms, Human 60ms) and granular 1–150ms slider.
  - Optional initial countdown timer (allows switching windows on PC before typing starts).
  - Real-time progress bar with instant emergency abort/stop button.
- 🖱️ **Full USB Trackpad & Mouse**:
  - Smooth multi-touch trackpad surface with finger gliding and tap-to-click.
  - Dedicated Left Click and Right Click buttons.
  - Unified composite HID gadget operating concurrently with the keyboard.
- 🚀 **Desktop Hotkeys & Navigation**:
  - Quick-fire tiles: `Win+R` (Run), `Win+L` (Lock), `Win+D` (Desktop), `Win+E` (Explorer), `Ctrl+Shift+Esc` (Task Manager), `Ctrl+Alt+Del`, `Alt+Tab`, `Alt+F4`, `Ctrl+C`, `Ctrl+V`, `Ctrl+A`, `Ctrl+Z`.
  - Directional navigation cluster: `▲`, `◀`, `▼`, `▶`.
- 🔌 **Dynamic Hardware State Monitoring**:
  - Live USB connection indicator (`🟢 Connected` vs `⚪ Not Connected`).
  - Reads Linux kernel UDC state in real time.
- 🌐 **Zero-Config Local Network & Domain**:
  - Binds to `0.0.0.0:8088`.
  - Served locally on the phone as `http://hid.keyboard` or `http://localhost:8088`.
  - Accessible from any computer, tablet, or phone on the same local Wi-Fi.
- 🛠️ **CLI Injector (`usbtype`)**:
  - Standalone command-line injector for terminal scripting and automation.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│             Mobile Web Browser / PWA Client            │
│  (Typer Textarea | Live SwiftKey Mirror | Trackpad)    │
└───────────────┬────────────────────────┬───────────────┘
                │ REST API               │ WebSocket (/ws)
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│               FastAPI & Uvicorn Daemon                 │
│         (Crash-Safe Non-Blocking USB Controller)        │
└───────────────┬────────────────────────┬───────────────┘
                │ Report ID 1 (Kbd)      │ Report ID 2 (Mouse)
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│             /dev/hidg0 (Composite HID Gadget)          │
│               Linux kernel USB ConfigFS                │
└───────────────────────────┬────────────────────────────┘
                            │ USB Cable (OTG / UDC)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Host Computer (Windows / Mac / Linux)    │
│            HID Keyboard Device + HID-Compliant Mouse   │
└────────────────────────────────────────────────────────┘
```

---

## 📦 Requirements

- **Android Device**: Rooted with USB Gadget support (`configfs` / `f_hid`).
- **Operating Environment**: Kali NetHunter chroot, Termux (with root), or any Linux userland on Android.
- **Python**: Python 3.8+ with `fastapi`, `uvicorn`, `websockets`.

---

## 🚀 Quick Start & Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/usb-typer.git
cd usb-typer
```

### 2. Install dependencies
```bash
pip3 install -r requirements.txt
```

### 3. Deploy and start
Run the installation script as root on your device:
```bash
sudo ./install.sh
```

Or start manually:
```bash
# Setup the composite USB HID gadget
sudo python3 setup_gadget.py

# Launch the server
python3 server.py
```

### 4. Access the interface
- On the phone: Open Chrome and navigate to **`http://hid.keyboard`** or **`http://localhost:8088`**.
- From local network: Navigate to **`http://<phone-ip>:8088`**.
- Tap the 3 dots in Chrome and select **"Add to Home Screen"** to install as a full-screen PWA.

---

## 💻 CLI Usage (`usbtype`)

The repository includes a standalone command-line tool `usbtype`:

```bash
# Check USB connection status
usbtype --status

# Type a string into the connected PC
usbtype "Hello, World!"

# Type with custom stroke delay (in milliseconds)
usbtype --delay 40 "Typing slowly..."

# Send special keys or shortcut combinations
usbtype --key enter
usbtype --key win+r
usbtype --key ctrl+shift+esc
```

---

## 📡 REST API Reference

| Endpoint | Method | Payload | Description |
| :--- | :--- | :--- | :--- |
| `/api/status` | `GET` | — | Returns UDC state, speed, and HID nodes status |
| `/api/type` | `POST` | `{"text": "...", "delay_ms": 15, "initial_delay_s": 0}` | Queues text typing in a background worker |
| `/api/stop` | `POST` | — | Aborts active typing job immediately |
| `/api/key` | `POST` | `{"key": "enter"}` or `{"combo": "win+r"}` | Injects single key or shortcut combo |
| `/api/mouse` | `POST` | `{"dx": 10, "dy": -5, "buttons": 1}` | Injects relative cursor movement or click |
| `/ws` | `WebSocket` | JSON actions (`live_char`, `mouse_move`, `mouse_click`) | Sub-5ms low-latency streaming channel |

---

## 🛡️ Crash-Safety & Kernel Protection

Legacy Android HID apps frequently cause kernel panics (`AP_S_PANIC` / `osq_lock` mutex deadlocks) when blocking `open()` / `write()` calls hang during USB disconnections. 

USB Typer implements:
- **Non-blocking file descriptors** (`os.O_NONBLOCK | os.O_WRONLY`).
- **`select.select(..., 0.05)` I/O timeout** before writing.
- **On-demand descriptor lifecycle**: Descriptors are opened and closed per report batch, preventing stale locks.
- **Pre-flight UDC state verification**: Verifies that the USB controller is in `configured` state before attempting writes.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
