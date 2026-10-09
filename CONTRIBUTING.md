# Contributing to Emittr ⚡

Thank you for your interest in contributing to **Emittr**! Whether you are fixing a bug, expanding HID scancode maps, polishing the Material 3 Cyberdeck UI, or testing compatibility across phone hardware, your contributions are welcome.

---

## 📜 Table of Contents
1. [Code of Conduct](#-code-of-conduct)
2. [How Can I Contribute?](#-how-can-i-contribute)
3. [Architecture Overview](#-architecture-overview)
4. [Development Setup](#-development-setup)
   - [Local PC Simulation (Fast & Easy)](#1-local-pc-simulation-fast--easy)
   - [Physical Android Hardware Testing](#2-physical-android-hardware-testing)
5. [Git Workflow & Commit Guidelines](#-git-workflow--commit-guidelines)
6. [Hardware Safety Rules (Must Read)](#-hardware-safety-rules-must-read)

---

## 🤝 Code of Conduct
This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms to foster a welcoming, inclusive, and harassment-free community.

---

## 💡 How Can I Contribute?

### 1. Reporting Bugs
- Search existing [Issues](https://github.com/mr-anjaneyam/Emittr/issues) before opening a new one.
- Use our [Bug Report Template](https://github.com/mr-anjaneyam/Emittr/issues/new?template=bug_report.yml) and include phone model, kernel version, target OS, and logs from `/var/log/usb_deck.log`.

### 2. Suggesting Features
- We love fresh ideas! Use our [Feature Request Template](https://github.com/mr-anjaneyam/Emittr/issues/new?template=feature_request.yml) to outline your motivation and technical proposal.

### 3. Submitting Hardware Compatibility Reports
- Have you tested Emittr on a phone model or custom kernel? Submit a [Hardware Compatibility Report](https://github.com/mr-anjaneyam/Emittr/issues/new?template=hardware_compatibility.yml) so we can update the community device roster.

### 4. Code & Documentation PRs
- Fork the repository, create a descriptive branch, implement your changes, and open a Pull Request!

---

## 🏛️ Architecture Overview

```
├── server.py           # Core FastAPI backend, WebSocket server & HID writer
├── setup_gadget.py     # Linux USB ConfigFS composite gadget initializer (/dev/hidg0)
├── usbtype             # Standalone Python CLI tool for terminal/SSH typing
├── static/             # PWA Web Deck UI (Vanilla HTML5 / CSS3 / ES6 JavaScript)
│   ├── index.html      # Mobile-first Material 3 UI markup
│   ├── style.css       # Unified design system & responsive layout styles
│   ├── app.js          # Client WebSocket logic, touchpad digitizer, Xbox thumbsticks
│   └── sw.js           # Progressive Web App service worker
├── install.sh          # Kali NetHunter / Magisk automated deployment script
├── start.sh            # NetHunter chroot startup script
└── docs/               # GitHub Pages landing page & documentation
```

---

## 💻 Development Setup

### 1. Local PC Simulation (Fast & Easy)
You do **not** need a rooted Android phone to work on the Web UI, API routes, or docs!

1. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/Emittr.git
   cd Emittr
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # Linux/macOS:
   source venv/bin/activate
   # Windows:
   .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the development server:
   ```bash
   python server.py
   ```
5. Open `http://localhost:8088` in your browser.
   *(Note: On non-Android OSes, write operations to `/dev/hidg0` gracefully fail silently, allowing full frontend UI and WebSocket development).*

---

### 2. Physical Android Hardware Testing
When testing actual USB keystrokes, mouse deltas, and kernel ConfigFS bindings:

1. Push your modified files to your phone via ADB:
   ```bash
   adb push server.py /opt/usb_hid_deck/
   adb push setup_gadget.py /opt/usb_hid_deck/
   adb push static /opt/usb_hid_deck/
   ```
2. Restart the daemon on the device:
   ```bash
   adb shell "su -c 'bash /opt/usb_hid_deck/start.sh'"
   ```
3. Inspect live logs:
   ```bash
   adb shell "su -c 'tail -f /var/log/usb_deck.log'"
   ```

---

## 🌿 Git Workflow & Commit Guidelines

We use **Conventional Commits** to keep the history clean and automated changelog-ready:

| Prefix | Description | Example |
|---|---|---|
| `feat:` | A new user-facing feature | `feat: add azerty french keyboard scancode mapping` |
| `fix:` | A bug fix | `fix: resolve stuck modifier key on abrupt cable disconnect` |
| `docs:` | Documentation changes only | `docs: add troubleshooting steps for poco f1 kernel` |
| `style:` | CSS or formatting changes | `style: improve thumbstick contrast on light theme` |
| `refactor:` | Code changes that neither fix a bug nor add a feature | `refactor: clean up websocket message serialization` |
| `perf:` | Performance improvements | `perf: optimize trackpad touch event throttling` |

---

## ⚠️ Hardware Safety Rules (Must Read)

Because Emittr interacts directly with kernel USB hardware endpoints, keep these safety principles in mind:

1. **Always Flush Null Reports:** Any function that presses a key or mouse button MUST ensure an all-zero release report is transmitted in a `finally` block or release queue. Leaving a <kbd>Ctrl</kbd> or <kbd>Enter</kbd> key stuck down can crash the target host or disrupt the user's OS.
2. **Preserve Kernel Watchdog:** Never disable or bypass the UDC state monitor in `server.py`. It is the safety net that prevents NetHunter from hijacking the USB port for mass storage.
3. **Keep UI Assets Lightweight:** The Web Deck runs on local phone browsers and low-power devices. Avoid heavy frameworks or external runtime dependencies in `static/`.

---

Thank you for building the future of tactical physical USB controllers with us! 🚀
