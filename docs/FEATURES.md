# Emittr — Features & Use Cases

*(Analysis excludes the `docs/` directory, which is a separate landing-page build.)*

## What It Is
Emittr turns a rooted Android/NetHunter phone into a genuine **USB HID device** (keyboard + mouse) using the Linux kernel's `configfs` USB gadget framework. The phone plugs into a target PC via USB-OTG and the OS recognizes it as a real, driver-free physical keyboard/mouse, while the phone's browser (PWA) acts as the remote control surface over WebSocket/REST.

---

## Core Feature List

### 1. USB HID Gadget Engine (`setup_gadget.py`)
- Builds a composite HID descriptor with two Report IDs in one gadget: Report ID 1 = Keyboard (9-byte boot-protocol report, 6-key rollover), Report ID 2 = Mouse (6-byte report: buttons, dx, dy, wheel, AC Pan).
- Sets custom VID/PID (Linux Foundation composite HID: `0x1d6b:0x010a`) so it enumerates as a generic HID device, not "Android phone."
- Disables Android's `sys.usb.config` / `persist.sys.usb.config` properties to stop the framework from silently reverting to mass-storage/MTP mode.
- Auto `chmod 666 /dev/hidg*` so the server can read/write without extra privilege prompts.
- Idempotent re-init — safe to call repeatedly if config drifts.

### 2. FastAPI Backend Daemon (`server.py`)
- Single always-on daemon on port `8088`, non-blocking asyncio server.
- Watchdog loop (every 1.5s): detects if Android reverted the gadget to mass-storage and silently re-applies the HID config; detects cable reconnect transitions and auto-flushes zero reports to prevent stuck keys.
- Failsafe key/button release (`release_all`, `/api/release`, WS `release_all` action, and on server startup/shutdown) — guards against stuck Ctrl/Alt/Shift/GUI or held mouse buttons.
- Port 80 → 8088 redirector: raw asyncio TCP server returning HTTP 302 using the `Host:` header, so users can hit port 80 without binding conflicts.
- Anti-cache middleware: forces `no-cache` headers on `/`, `/static/*`, `/api/*` so PWA updates aren't stuck behind stale mobile browser caches.
- Full ASCII → USB HID scancode table (letters, digits, shifted symbols, whitespace), a special-keys table (F1–F12, arrows, Home/End/PageUp/Down, Esc, Tab, etc.), and a hotkey/combo table (`win+r`, `ctrl+alt+del`, `ctrl+shift+esc`, `alt+tab`, `ctrl+c/v/x/z/y/s/w/t`, `shift+arrows`, `ctrl+arrows`, etc.).

### 3. REST API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/status` | USB attach state, UDC name/speed, HID node existence, version |
| POST | `/api/release` | Emergency panic-release of all keys/buttons |
| POST | `/api/type` | Queue bulk text typing with per-char delay and optional countdown |
| POST | `/api/stop` | Abort an in-flight typing job |
| POST | `/api/key` | Fire a named key or hotkey combo |
| POST | `/api/mouse` | One-shot mouse move/click/scroll (vertical + horizontal AC Pan) |

### 4. WebSocket Live Channel (`/ws`)
- Sub-5ms round trip for: `live_char` (keystroke mirroring), `mouse_move`, `mouse_click`, `mouse_scroll` (dual-axis), `release_all`, `get_status`.
- Server pushes async status broadcasts (typing progress, countdown ticks, USB attach/detach events) to every connected client.

### 5. Bulk Text Typer (Web UI)
- Paste arbitrary multi-line text/scripts and inject them as real keystrokes.
- Adjustable per-character delay slider (5ms "Instant" → 60ms "Human"), with preset pills.
- Pre-flight countdown timer (0–5s) to let the operator focus the right window first.
- Live progress bar + abort/stop button mid-job.

### 6. Live Keyboard Mirror
- Streams every character typed on the phone's own IME (Gboard/SwiftKey/voice-to-text) straight to the host in real time.
- Dedicated hardware-helper buttons for keys mobile keyboards omit: Tab, Esc, Backspace, and a 4-way arrow pad — useful for BIOS/GRUB/CLI menus.
- Collapsible keystroke history/telemetry feed.

### 7. Precision Trackpad
- Touch-to-relative-mouse-delta translation calibrated for phone digitizers.
- Two-finger scroll gesture (vertical + horizontal).
- Tap-to-click (sub-220ms gesture window).
- Dedicated Left/Middle/Right click buttons with haptic feedback (`navigator.vibrate`).
- Sensitivity slider (0.5×–2.0×), persisted to `localStorage`.

### 8. Dual Xbox-Style Thumbstick Scrolling
- Left stick = vertical scroll, right stick = horizontal scroll, with rate-based continuous ticks proportional to deflection and spring-back-to-center release.
- Horizontal scroll uses true HID AC Pan (Consumer Usage 0x0238), not a synthetic Shift+Wheel hack — maps to native `WM_MOUSEHWHEEL` in Windows and equivalents elsewhere.

### 9. Adaptive Dashboard UI (PWA)
- Responsive breakpoint at 900px: mobile gets a single scrollable unified deck with bottom tab navigation; desktop gets a 2-column layout (Typer/Shortcuts left, Touchpad+Joysticks+Live Keys right).
- Installable PWA (`manifest.json`): standalone display, portrait-primary orientation, custom icons/theme color — runs edge-to-edge with no browser chrome once added to home screen.
- Persisted user preferences via `localStorage`: theme (dark/light), haptics on/off, autoclear, auto-enter, countdown default, sensitivity, typing delay, dashboard-mode toggle.

### 10. Standalone CLI (`usbtype`)
- Hits the same local REST API — usable for scripting/automation independent of the browser UI.
- `usbtype "text"` — type a string.
- `-f file` — type file contents.
- `-d/--delay` — custom per-char delay.
- `-k/--key` — fire a key/hotkey.
- `--stop` — abort active typing job.
- `--status` — print connection state.

### 11. Deployment & Persistence Tooling
- `install.sh` — one-shot installer: copies files to `/opt/usb_hid_deck`, symlinks `usbtype` to `/usr/local/bin`, disables Android USB auto-config, runs gadget init, adds `hid.keyboard` to `/etc/hosts` (chroot and Android system hosts if writable), kills/restarts the daemon, runs a health check against `/api/status`.
- `start.sh` — quick restart helper (kill + relaunch daemon) without full reinstall.
- `02-usb-deck.sh` — Magisk `service.d` boot script: waits for `sys.boot_completed`, re-suppresses mass-storage auto-config, fixes `/dev/hidg*` perms, bind-mounts a patched `/system/etc/hosts` for `hid.keyboard`, and boots into the NetHunter chroot (`bootkali`) to auto-launch the gadget + server — giving reboot-persistent operation.

---

## Why It Beats Alternatives
| Feature | Shady Wi-Fi / Bluetooth Apps | BadUSB USB Sticks | Emittr |
|---|---|---|---|
| Host PC setup | Needs client .exe/drivers | None (blind flash drive) | Zero host install — works on BIOS, Windows, Mac, Linux, PS5 |
| Network dependency | Needs shared Wi-Fi/pairing | None | Pure physical USB cable — works air-gapped |
| Interactive control | Laggy & unreliable | Impossible (read-only script) | Real-time typing, live touchpad, shortcuts, joysticks |
| Scrolling | Clunky fake wheel ticks | None | Dual Xbox joysticks with native hardware AC Pan |
| Modifier safety | Prone to stuck keys/lockup | No state recovery | Hardware zero-flush guard + auto-reconnect flush |
| USB mode persistence | N/A | N/A | Active kernel watchdog preserves HID gadget mode |

---

## Why Emittr Beats a Regular Keyboard — and Every Remote-Control App You've Tried

**You already carry the only input device you'll ever need. You just didn't know it yet.**

### 🆚 Regular Keyboards & Mice
- **Never forget it again.** Your keyboard lives in your bag, at your desk, in a drawer. Your phone lives in your pocket. Emittr means the keyboard is wherever you are — every time.
- **One device, every computer.** Stop carrying a travel keyboard for your laptop, a separate one for your HTPC, and a spare for the BIOS console in the server room. It's all the same phone.
- **No wear, no crumbs, no dead keys.** Nothing to spill coffee on, no keys to stick, no broken switches after five years of gaming — it's software, refreshed the moment you update the app.
- **Bigger, smarter typing surface.** Autocorrect, swipe-typing, voice dictation, emoji picker — everything your phone's keyboard already does better than a $10 membrane keyboard, now typing directly into your PC.
- **A trackpad *and* a keyboard *and* a game-style scroll stick** — in the same slab of glass you're already holding. No more juggling three peripherals for one desk.

### 🆚 Wi-Fi & Bluetooth "Remote Keyboard/Mouse" Apps
- **No app store roulette.** No hunting for "best remote mouse app 2026," wading through five copycats full of ads, paywalls, and permissions you don't trust.
- **No subscriptions, no ads, no "Pro" unlock.** Most remote-control apps nickel-and-dime you for scroll wheel support or multi-device profiles. Emittr ships everything, free, forever.
- **No pairing dance.** No Bluetooth pairing codes, no "waiting for connection," no dropped pairing when you walk to another room. Plug in the cable, you're live.
- **No lag, no dropped keystrokes.** Wi-Fi apps fight your router, your firewall, and everyone else's Netflix stream. Emittr rides a dedicated physical USB wire — nothing else on Earth is competing for that bandwidth.
- **Works where those apps physically can't.** Remote apps need the target machine to be booted, unlocked, online, and running their companion software. Emittr works at the BIOS screen, at the login prompt, on a fresh install with zero network — because to the PC, it's not "an app," it's a real keyboard plugged into a real port.
- **Total privacy.** Wi-Fi remote apps route your keystrokes through their own client software (and sometimes their own servers). Emittr's keystrokes never leave the USB cable between your phone and your PC.

### 💬 The Pitch
Stop buying travel keyboards. Stop installing shady remote-control apps riddled with ads. Stop fumbling with a game console's on-screen keyboard using a thumbstick. The phone in your pocket is already faster, smarter, and more capable than the keyboard on your desk — Emittr just lets it prove it.

---

## Use Cases

### Security / Red-Team & Pentest
- Air-gapped or BIOS-locked workstation access — type payloads before an OS/IME even loads, with no client software or network dependency.
- Interactive payload delivery with a live abort switch — unlike a rubber ducky, you can watch it type and stop it if a shell lags or the wrong window has focus.
- Credential/Wi-Fi password injection onto systems where copy-paste or clipboard sync is blocked.

### SysAdmin / Field IT
- Headless server or embedded device console access — type commands into a serial/VGA-console terminal without a spare keyboard.
- Remote/local BIOS, UEFI, GRUB navigation using the dedicated arrow pad and Tab/Esc buttons mobile IMEs normally lack.
- Long config/script pasting into terminals that would otherwise require re-typing by hand.

### Home Entertainment & Media
- Smart TV / Android TV / Kodi / Plex box search — type show/movie/song names instead of hunting-and-pecking with a D-pad remote.
- HTPC couch control — browse files, adjust volume, scroll long lists from the couch without walking to the desk.
- Karaoke/party jukebox — guests type song requests quickly instead of passing around a keyboard.

### Gaming & Consoles
- PS5/console text entry — type PSN messages, game search terms, or account names instead of the slow on-screen keyboard + controller combo.
- Console Wi-Fi/account setup — enter long Wi-Fi passwords or account credentials on a new console/streaming stick in seconds.

### Accessibility & Ergonomics
- Alternative input for limited dexterity/tremor/RSI — touch trackpad with adjustable sensitivity can be gentler than a stiff physical keyboard.
- Voice-to-text bridging — dictate on the phone, then have it typed instantly into a PC app that doesn't support dictation natively.
- Familiar touch UI for elderly or less tech-savvy users, easier than learning a new physical keyboard layout.

### Personal Privacy & Security (non-pentest)
- Avoiding public/shared keyboards — on a library, hotel business center, or internet café PC, plug in your own phone to type a password instead of trusting unknown keyboard hardware.
- Hygiene — use your own "keyboard" instead of a shared, germy public terminal keyboard.

### Presentations, School & Work-Adjacent
- Slide clicker / presenter remote — walk around the room while advancing slides, using the trackpad as a laser-pointer-style cursor.
- Classroom teaching — control the classroom PC/projector from anywhere in the room.
- Student project demos — present from a borrowed/shared laptop without installing anything on it.

### Travel, Backup & Minimalism
- Emergency backup input — laptop's built-in keyboard or trackpad breaks; the phone instantly becomes a replacement.
- Tablet/Chromebook-only travelers — fill in for the rare moment you need full text entry into another device.
- New PC/laptop first boot — type Wi-Fi passwords or setup info before pairing your usual peripherals.

### Social, Family & Events
- Helping non-technical relatives — type settings or passwords for them via your own phone, without taking over their physical keyboard.
- Event kiosks / photo booths / guestbooks — type your name/message using your own phone instead of a shared touchscreen or keyboard.
- Shared family PC — control the family PC/TV from the couch without disturbing others at the desk.

### Everyday Convenience
- Multi-device switching — walk between a personal and a work laptop using one "input device" instead of buying a hardware KVM switch.
- Better horizontal scrolling — the native AC Pan joystick makes browsing wide spreadsheets or long web pages smoother than many budget Bluetooth mice.
- No pairing hassles — skip Bluetooth pairing dropouts entirely for a quick one-off task, just plug in the cable.

---

## Known Limitation
Text injection currently maps standard ASCII only (letters, digits, punctuation, whitespace). Emoji and non-Latin scripts are not supported by the current `ASCII_MAP`/`SPECIAL_KEYS` tables.
