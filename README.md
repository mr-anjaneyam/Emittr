# Emittr — Tactical USB HID Controller ⌨️ 🖱️

> **Transform rooted Android devices and NetHunter phones into a tactical, crash-resilient USB HID Keyboard, Precision Touchpad, and Dual Scroll Deck with a high-performance Material Design 3 Web App.**

[![Release](https://img.shields.io/badge/release-v1.2.1-blue.svg)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.8+-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-teal.svg)](https://fastapi.tiangolo.com/)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20NetHunter%20%7C%20Linux-orange.svg)](#requirements)

Emittr turns an Android device (running Kali NetHunter or any Linux chroot with kernel USB gadget configfs) into a hardware-emulated USB Human Interface Device (HID). It operates concurrently as a standard 104-key USB Keyboard and an ergonomic USB Mouse with multi-axis scrolling, plug-and-play compatible with Windows, macOS, Linux, and gaming consoles.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [How It Works & Architecture](#-how-it-works--architecture)
- [Hardware & Kernel Requirements](#-hardware--kernel-requirements)
- [Installation & Quick Start](#-installation--quick-start)
- [NetHunter Mass-Storage Prevention & USB Watchdog](#-nethunter-mass-storage-prevention--usb-watchdog)
- [Modifier Key Safety & Emergency Unstick](#-modifier-key-safety--emergency-unstick)
- [Touchpad & Scrolling Mechanics](#-touchpad--scrolling-mechanics)
- [Desktop Dashboard Mode (PC / Large Screens)](#-desktop-dashboard-mode-pc--large-screens)
- [REST API & WebSocket Protocol](#-rest-api--websocket-protocol)
- [CLI Tool (`usbtype`)](#-cli-tool-usbtype)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [License](#-license)

---

## 🌟 Overview

Whether you are performing tactical red-team keystroke injection, managing a headless server from your phone, typing long texts and code snippets onto a locked-down workstation, or simply using your phone as an emergency keyboard and trackpad, Emittr provides a seamless, lag-free bridge over standard USB OTG.

Unlike Bluetooth or Wi-Fi remote-input apps, Emittr presents itself as a **genuine USB hardware device** at the physical bus level. No host software, drivers, or agent installations are needed on the target PC.

---

## ✨ Key Features

### 1. ⌨️ Live Keyboard Mirroring
- **Universal Input Engine**: Type with SwiftKey, Gboard, Samsung Keyboard, or voice-to-text. Keystrokes are diffed and sent over a sub-5ms low-latency WebSocket connection.
- **Hardware Helper Keys**: Dedicated tap targets for `Backspace ⌫`, `Tab ⇥`, `Enter ↵`, `Escape`, and arrow keys (`▲`, `◀`, `▼`, `▶`).
- **Collapsible Strokes Feed**: A sleek, non-distracting key history feed that can be toggled on demand.

### 2. 📝 Bulk Text Typer
- **Customizable Speed Engine**: Preset typing speeds (*Instant* 5ms, *Fast* 15ms, *Normal* 35ms, *Human* 60ms) plus a granular 1–150ms per-character slider.
- **Pre-Flight Countdown**: Optional 1 to 5 second timer allowing you to switch to the target window on the PC before typing begins.
- **Real-time Progress & Emergency Stop**: Visual progress bar with instant abort functionality.

### 3. 🖱️ Precision Trackpad & Touchpad Gestures
- **Smooth Cursor Gliding**: Single-finger touch glide scaled with configurable mouse sensitivity (0.5× – 2.0×).
- **Two-Finger Multi-Touch Scrolling**: Natural touchpad scrolling in both directions:
  - Slide two fingers up/down for vertical scrolling.
  - Slide two fingers left/right for horizontal scrolling.
- **Tap-to-Click**: Sub-220ms gesture recognition for instantaneous left click.
- **Mouse Buttons**: Dedicated *Left*, *Middle*, and *Right* click buttons.

### 4. 🎛️ Dual Physical Scroll Wheels (Side-by-Side Dock)
- **Ergonomic Bottom Placement**: Positioned in the bottom space side by side for thumb access:
  - **Left Wheel (↕ Vertical)**: Realistic knurled drum barrel for vertical page scrolling.
  - **Right Wheel (↔ Horizontal)**: Knurled barrel executing universal horizontal scrolling (`Shift + Mouse Wheel`).
- **Tactile Physics**: Inset drum ridges, center reticle alignment, notch snap animations, and micro-haptic vibration (4ms) per notch.

### 5. 🚀 Tactical Hotkeys Deck
- **Windows hotkeys**: `Win+R` (Run), `Ctrl+Shift+Esc` (Task Manager), `Win+L` (Lock), `Win+D` (Desktop), `Win+E` (Explorer), `Alt+Tab`, `Alt+F4`, `Ctrl+C`, `Ctrl+V`, `Ctrl+A`, `Ctrl+Z`.
- **Directional cluster**: Standard physical arrow cross for navigation in BIOS, bootloaders, and text documents.

### 6. 🚨 Emergency Modifier Unstick ("PC Poisoning" Prevention)
- In USB HID devices, if a device disconnects while a modifier (like `Ctrl` or `Shift`) is active, the host OS keeps the key depressed in driver memory.
- Emittr features an instant **"Unstick Keys"** header button and automatic startup/reconnect flush that injects a clean null report to release all stuck keys immediately.

### 7. 🖥️ Responsive Desktop Dashboard Mode
- When accessed from a desktop or laptop browser (`min-width: 900px`), Emittr expands into a **multi-panel tactical grid**.
- Displays the Typer, Live Keys, Shortcuts Deck, and Trackpad simultaneously side by side.

---

## 🏗️ How It Works & Architecture

```
┌────────────────────────────────────────────────────────┐
│             Mobile Web Browser / PWA Client            │
│  (Typer Textarea | Live SwiftKey Mirror | Trackpad)    │
└───────────────┬────────────────────────┬───────────────┘
                │ REST API               │ WebSocket (/ws)
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│               FastAPI & Uvicorn Daemon                 │
│         (Active USB Watchdog & Gadget Persist)         │
└───────────────┬────────────────────────┬───────────────┘
                │ Report ID 1 (Kbd)      │ Report ID 2 (Mouse)
                ▼                        ▼
┌────────────────────────────────────────────────────────┐
│             /dev/hidg0 (Composite HID Gadget)          │
│               Linux kernel USB ConfigFS                │
└───────────────────────────────┬────────────────────────┘
                                │ USB Cable (OTG / UDC)
                                ▼
┌────────────────────────────────────────────────────────┐
│         Host Computer (Windows / macOS / Linux)        │
│    Recognized natively as standard Keyboard & Mouse    │
└────────────────────────────────────────────────────────┘
```

1. **Linux Configfs Composite Gadget**:
   - Instead of unstable legacy Android gadgets, Emittr configures a single unified composite HID device on `functions/hid.0` mapping to `/dev/hidg0`.
   - **Report ID 1**: 8-byte boot keyboard payload (modifiers byte + reserved + 6 keycodes).
   - **Report ID 2**: 4-byte mouse payload (5 button bits + 3 pad bits, relative X, relative Y, relative Wheel).
2. **FastAPI Non-Blocking Controller**:
   - Opens `/dev/hidg0` with `O_NONBLOCK` and `select.select(..., 0.05)` timeout protection to eliminate kernel deadlocks and `AP_S_PANIC` crashes.
3. **Loopback Port 80 Redirector**:
   - An asynchronous userland TCP listener redirects incoming port 80 traffic to 8088 without using `iptables` NAT loopback rules.

---

## 💻 Hardware & Kernel Requirements

- **Device**: Android phone with root access (Magisk recommended).
- **Tested Hardware**: Honor 9 Lite (`LLD-AL10`, HiSilicon Kirin 659 / `hisi-usb-otg`), Nexus 5/6P, OnePlus devices.
- **Kernel**: Linux kernel 3.18, 4.4, 4.9, 4.14, 4.19, or 5.x built with:
  - `CONFIG_USB_CONFIGFS=y`
  - `CONFIG_USB_CONFIGFS_F_HID=y`
  - `CONFIG_USB_F_HID=y`
- **Environment**: Kali NetHunter chroot or standalone Debian/Ubuntu rootfs.
- **Python**: Python 3.8+ with `fastapi`, `uvicorn`, and `pydantic`.

---

## 📦 Installation & Quick Start

### 1. Clone & Transfer to Device
```bash
git clone https://github.com/mranj/usb-typer.git
cd usb-typer
```

### 2. Run Standalone Installer on the Phone
Inside your NetHunter chroot terminal as root:
```bash
bash install.sh
```
This automated script:
1. Installs files to `/opt/usb_hid_deck/`.
2. Symlinks the `usbtype` CLI tool to `/usr/local/bin/usbtype`.
3. Disables Android's automatic USB mass-storage reset triggers.
4. Initializes `/config/usb_gadget/g1` with the composite HID descriptor.
5. Launches the background server daemon on port `8088`.

### 3. Autostart via Magisk on Boot
Copy `02-usb-deck.sh` into your Magisk service directory:
```bash
cp /opt/usb_hid_deck/02-usb-deck.sh /data/adb/service.d/02-usb-deck.sh
chmod +x /data/adb/service.d/02-usb-deck.sh
```

### 4. Access the Web App
Connect your phone to the target PC using a standard USB-C or Micro-USB OTG cable.
- On your phone's browser: **`http://hid.keyboard`** or **`http://localhost:8088`**
- From any device on your Wi-Fi: **`http://<phone-ip>:8088`**
- Tap Chrome menu -> **"Add to Home Screen"** to install as a full-screen PWA.

---

## 🛡️ NetHunter Mass-Storage Prevention & USB Watchdog

### Why does NetHunter revert to mass storage?
On Android devices, the Android framework daemon (`UsbDeviceManager`) listens for kernel USB disconnect events. When the USB cable is unplugged, Android's framework automatically resets `sys.usb.config` to `persist.sys.usb.config` (typically `mtp,mass_storage` or `hisuite`), which destroys the HID gadget symlinks in `/config/usb_gadget/g1/configs/b.1/`.

### How Emittr solves it:
1. **Property Suppression**:
   `persist.sys.usb.config` and `sys.usb.config` are set to `none`.
2. **Active Watchdog Loop**:
   Every 1.5 seconds, `server.py` checks whether `/config/usb_gadget/g1/configs/b.1/f1` points to `functions/hid.0`. If Android ever hijacks the gadget, Emittr tears down the rogue links, rebinds `hid.0`, and restores `/dev/hidg0` instantly without requiring a phone reboot.

---

## 🚨 Modifier Key Safety & Emergency Unstick

### The "Stuck Ctrl" Problem
When a USB keyboard is unplugged or disconnected from a PC while a modifier key (`Ctrl`, `Shift`, `Alt`, `Win`) is pressed, Windows keeps that key in the "down" state in its global keyboard driver state. The user is unable to type normally until a key-up report is received.

### Emittr's Multi-Tier Protection:
1. **`finally` Execution Guarantee**: Keystroke routines wrap the key-up report in Python `try ... finally` blocks to ensure releases are sent even if the host connection drops.
2. **Plug-In Flush**: The moment the UDC detects a transition to `configured` (USB cable plugged into host), Emittr immediately flushes a 9-byte keyboard zero report and a 5-byte mouse zero report.
3. **One-Tap Unstick Button**: The UI header features a dedicated **"Unstick Keys"** button that fires `/api/release`, releasing all modifiers and mouse buttons instantly.

---

## 🖐️ Touchpad & Scrolling Mechanics

### Two-Finger Touchpad Gestures
Emittr includes a dual-axis sub-pixel touch accumulator (`accumScrollX`, `accumScrollY`).
- Sliding two fingers vertically triggers vertical mouse wheel ticks (`wheel_v`).
- Sliding two fingers horizontally triggers horizontal scroll ticks (`wheel_h`).
- Micro-haptic vibration provides subtle physical feedback as each scroll notch fires.

### Horizontal Scroll Parity (`Shift + Wheel`)
Across Windows, Linux, and macOS, horizontal wheel scrolling is natively executed by holding `Left Shift` while scrolling the mouse wheel.
- **Vertical Wheel Drum**: Emits standard mouse wheel ticks (`wheel`).
- **Horizontal Wheel Drum**: Emits `Shift + Mouse Wheel` (`wheel_h`), enabling smooth horizontal scrolling in Excel, VS Code, Chrome, File Explorer, and code editors.
- **Desktop Parity**: When accessing Emittr from a desktop browser, holding the physical `Shift` key while using your mouse wheel on the trackpad surface triggers horizontal scrolling.

---

## 🖥️ Desktop Dashboard Mode (PC / Large Screens)

Emittr features responsive design tailored for dual-use:
- **Mobile Phones (`< 900px`)**: Single-column thumb-friendly view with a bottom navigation bar.
- **Desktop Monitors (`≥ 900px`)**: Displays the top navigation bar and allows enabling **Dashboard Mode** via the header toggle.
  - In Dashboard Mode, the layout transforms into a wide dual-column tactical command center:
    - **Left Column**: Text Typer & Live Keys IME mirror with stroke history.
    - **Right Column**: Touchpad & Dual Scroll Wheels with Shortcuts Deck.

---

## 🔌 REST API & WebSocket Protocol

Emittr exposes an asynchronous REST and WebSocket API on port `8088`.

### REST Endpoints

| Method | Endpoint | Description | Sample Payload |
|---|---|---|---|
| `GET` | `/api/status` | Current USB connection state, UDC details, and version | `None` |
| `POST` | `/api/release` | Emergency unstick: release all modifiers and mouse buttons | `{}` |
| `POST` | `/api/type` | Types a block of text onto the host PC | `{"text": "Hello World", "delay_ms": 15, "initial_delay_s": 0}` |
| `POST` | `/api/stop` | Aborts active typing job | `{}` |
| `POST` | `/api/key` | Injects a shortcut combo or special key | `{"combo": "win+r"}` or `{"key": "enter"}` |
| `POST` | `/api/mouse` | Injects mouse movement, clicks, or scroll | `{"dx": 10, "dy": -5, "wheel": 2, "wheel_h": 0}` |

### WebSocket Messages (`ws://<ip>:8088/ws`)

Clients can send JSON commands over `/ws` for sub-5ms low latency:
```json
// Live keystroke
{ "action": "live_char", "char": "a" }

// Mouse movement
{ "action": "mouse_move", "dx": 12, "dy": -4 }

// Mouse click (1=Left, 2=Right, 4=Middle)
{ "action": "mouse_click", "button": 1 }

// Multi-axis scroll
{ "action": "mouse_scroll", "wheel_v": -2, "wheel_h": 0 }

// Emergency release
{ "action": "release_all" }
```

---

## ⌨️ CLI Tool (`usbtype`)

Emittr includes a standalone terminal CLI for scripting and automation:

```bash
# Check USB connection status
usbtype --status

# Type a string onto the target machine
usbtype "sudo apt update && sudo apt upgrade -y"

# Type with custom delay (30ms per character)
usbtype --delay 30 "Slow typing text block"

# Inject special keys or shortcuts
usbtype --key win+r
usbtype --key enter
usbtype --key ctrl+alt+del
```

---

## ❓ Troubleshooting & FAQ

### 1. Windows reports `Code 10: Device cannot start`
- Ensure you are running Emittr v1.2.1. In earlier versions, having multiple separate `hid.0` and `hid.1` functions caused a descriptor length collision in the Linux 4.4 kernel. Emittr v1.2.1 uses a unified composite HID descriptor on a single node `/dev/hidg0`.

### 2. My PC's `Ctrl` key is stuck down after unplugging
- Tap the red **"Unstick Keys"** button in the Emittr header.
- Alternatively, press and release `Left Ctrl` and `Right Ctrl` once on any physical keyboard attached to the PC.
- In Emittr v1.2.1, plug-in zero report flushes eliminate this issue automatically.

### 3. Trackpad moves but scroll does nothing
- Verify that Emittr v1.2.1 is running by checking the header version badge.
- When using the two-finger gesture, ensure two fingers are placed simultaneously on the surface.
- For horizontal scrolling, the target application must support horizontal scroll (e.g., Excel, wide code editor, or browser).

### 4. How do I access via `http://hid.keyboard` without specifying port 8088?
- Emittr runs an asynchronous port 80 redirector in userland. As long as `hid.keyboard` resolves to `127.0.0.1` on the phone (automatically configured by `02-usb-deck.sh`), typing `http://hid.keyboard` will route directly to port 8088.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
