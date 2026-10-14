# Emittr: Tactical USB HID Controller - Frontend Design Specification

## 1. Project Concept & Hardware Context

Emittr transforms a low-cost Single Board Computer (such as a Raspberry Pi Zero W or Zero 2 W) into a hardware-level USB Human Interface Device (HID) gadget.

### How It Works
- **Physical Connection**: The device connects via USB OTG to any target computer (Windows, macOS, Linux, ChromeOS, BIOS/UEFI, or Android). The target PC detects it as a genuine hardware USB composite keyboard and mouse. No drivers, software, or permissions are needed on the target host.
- **Wireless Control Interface**: The Raspberry Pi hosts a lightweight web application over Wi-Fi (either running its own Wi-Fi Access Point or connected to a local network).
- **Primary Use Cases**: IT administration, data entry automation, incident response, testing, automated form filling, server maintenance, remote presentation control, and mobile mouse/keyboard replacement.
- **Core Value**: Users control target computers directly from their smartphones, tablets, or laptops through a fast, touch-first web interface.

---

## 2. Redesign Vision & Design Goals

The objective is a complete ground-up redesign of layout, typography, navigation, component architecture, and styling:

1. **Touch-First Ergonomics**: Designed for single-hand and two-thumb mobile operation. Minimum touch targets of 48px height, accessible thumb navigation, and fluid gesture handling.
2. **Tactical & Premium Aesthetic**: Modern, clean, dark-mode default with refined accents. High visual hierarchy, sharp badges, smooth micro-interactions, subtle borders, and zero clutter.
3. **Zero-Latency Feel**: Keystrokes, hotkeys, and cell clicks must provide immediate visual feedback (active pulse, ripple, or glow) and optional haptic vibration.
4. **Adaptive Responsive Layout**: 
   - **Mobile (portrait)**: Bottom navigation bar, swipeable cards, full-width touch surfaces, sticky column table scrolling.
   - **Tablet / Desktop**: Top pill navigation or collapsible sidebar, grid arrangements, and an optional multi-panel Dashboard Mode.

---

## 3. Information Architecture & Navigation

The application consists of 6 primary operational views plus a global header and settings/diagnostics modals:

```
[ App Header: Brand | Latency | Host Status | Settings | Dashboard Mode ]
────────────────────────────────────────────────────────────────────────
  View 1: Typer          -> Bulk text entry, speed presets, countdown, quick macros
  View 2: Live Keys      -> Real-time keyboard mirror with stroke audit feed
  View 3: Shortcuts      -> Preset hotkey matrix (OS, navigation, media, browser)
  View 4: Macros         -> Folders, Text Macros, Multi-Key Hotkey builder
  View 5: Sheets         -> Temporary Cheat Sheet (Session) & Saved Macro Sheets
  View 6: Touchpad       -> Mouse glide area, buttons, dual Xbox scroll thumbsticks
────────────────────────────────────────────────────────────────────────
[ Mobile Bottom Nav: Typer | Live | Shortcuts | Macros | Sheets | Touchpad | Dashboard ]
```

---

## 4. Core Features & View Specifications

### View 1: Typer (Bulk Text to PC)
- **Text Area**: Large auto-sizing or fixed input accepting text, multi-line shell scripts, credentials, or URLs.
- **Speed Selector**: Preset pills controlling inter-keystroke typing speed:
  - Instant (5ms delay)
  - Fast (15ms delay, default)
  - Normal (35ms delay)
  - Human (60ms delay)
- **Countdown Delay**: 0s (Instant), 1s, 2s, 3s, or 5s timer allowing user to focus the target PC window before typing begins.
- **Action Controls**: Primary "Send to PC" button, "Stop" button (visible during active typing), and "Clear" button.
- **Progress Bar**: Displays real-time typing progress percentage and character counts.
- **Quick Macro Strip**: Horizontally scrollable strip of frequently used macros filtered by folder for one-tap execution.

### View 2: Live Keyboard Mirror
- **Concept**: Allows the mobile virtual keyboard to act as a direct USB keyboard for the PC in real time.
- **Target Zone**: Touch target that focuses a hidden input field to trigger the mobile on-screen keyboard.
- **Live Streaming**: Keypresses and backspaces are sent instantly over WebSockets.
- **Audit Feed**: Collapsible visual feed showing the last 10 transmitted keys with timestamps and status badges.

### View 3: Shortcuts Matrix (Tactical Hotkeys)
- **Concept**: One-tap trigger buttons for essential operating system commands.
- **Categories**:
  - **Windows / System**: Win+R (Run), Ctrl+Shift+Esc (Task Manager), Win+Shift+S (Snipping Tool), Alt+Tab, Alt+F4, Win+L (Lock), Win+D (Desktop).
  - **Clipboard & Edit**: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y, Ctrl+X.
  - **Browser & Dev**: F12 (DevTools), Ctrl+T (New Tab), Ctrl+W (Close Tab), Ctrl+Shift+T, Ctrl+F5 (Hard Refresh), F11 (Fullscreen).
  - **Navigation**: Arrow keys (Up, Down, Left, Right), Home, End, PageUp, PageDown.
  - **Media Controls**: Volume Up, Volume Down, Mute, Play/Pause.

### View 4: Macros & Hotkey Builder
- **Folder / Category System**: Organize macros by folder or person name (e.g. "Work Profiles", "Linux Admin", "Form Filler", "Hotkeys").
- **Folder Actions**: Filter tabs, category search, add new folder, rename folder, delete folder.
- **Two Distinct Macro Types**:
  1. **Text Macro**: Stores a text sequence with an Action After suffix (`tab`, `enter`, or `none`) and optional countdown delay.
  2. **Multi-Key Hotkey Macro**: Stores an arbitrary keyboard shortcut combo (e.g. `Ctrl+Alt+T`, `Win+Shift+S`, `Alt+Tab`).
- **Interactive Hotkey Modal**:
  - Mode toggle: [Text Keystrokes] vs [Multi-Key Hotkey].
  - Modifier toggle chips: [Ctrl] [Alt] [Shift] [Win/Cmd].
  - Key dropdown or input: Letters, numbers, Enter, Esc, Tab, Space, Backspace, Delete, Arrows, F1 to F12.
  - Live Preview Badge: Displays active combination formatted (e.g. `CTRL + ALT + T`).
  - Quick Presets Grid: Quick buttons for Run, Snipping Tool, Task Manager, Close Window, Terminal, DevTools.
- **Macro Cards**:
  - Displays macro name, category badge, action badge (⇥ Tab, ↵ Enter, ⚡ HOTKEY).
  - Direct "Send" / "Type" run button.
  - Edit, duplicate, and delete actions.
- **Import / Export**:
  - Direct CSV template download (`/api/macros/template.csv`).
  - Merge or replace import from CSV or JSON files.

### View 5: Macro Sheets & Temporary Cheat Sheet
This feature accelerates repetitive tabular data entry and form filling into target host systems.

#### Subview A: Temporary Cheat Sheet (Session-Only, Touch-First)
- **Primary Purpose**: Fast reference and form filling from imported Excel/CSV tables without persistent storage.
- **Session Lifecycle**: Data lives strictly in memory. Refreshing or closing the site completely resets it.
- **Sample Dataset (Default)**:
  - Columns: `Sample Name`, `DOB`, `Phone`, `ID`, `Email`
  - Records (8 rows):
    1. Rahul Sharma | 15/03/2002 | 9876543210 | ID1001 | rahul.sharma@example.com
    2. Priya Reddy | 22/07/2003 | 9876501234 | ID1002 | priya.reddy@example.com
    3. Arjun Kumar | 10/11/2001 | 9123456780 | ID1003 | arjun.kumar@example.com
    4. Sneha Patel | 05/02/2004 | 9988776655 | ID1004 | sneha.patel@example.com
    5. Kiran Rao | 18/09/2002 | 9012345678 | ID1005 | kiran.rao@example.com
    6. Ananya Verma | 27/12/2003 | 9098765432 | ID1006 | ananya.verma@example.com
    7. Vikram Singh | 14/06/2001 | 9345678120 | ID1007 | vikram.singh@example.com
    8. Divya Nair | 30/01/2004 | 9567812340 | ID1008 | divya.nair@example.com
- **Click-to-Type Cell Interaction**:
  - Every single cell is an instant touch button.
  - Tapping a cell types that value into the PC immediately.
  - **No confirmation modals or prompts**.
  - Visual pulse animation and `last-sent` border highlight for tactile tracking.
  - Action selector: `Type + Tab ⇥` (moves to next form field), `Type + Enter ↵`, or `Type Raw`.
- **Sequential Row Fill**:
  - `▶ 1`, `▶ 2` row runner button types the entire row sequentially separated by Tab characters.
- **Mobile Touch Layout**:
  - Container must use horizontal scrolling (`overflow-x: auto; min-width: 720px; width: max-content`).
  - Columns must never be squished or shrunk to fit a tiny mobile screen.
  - First column (`Sample Name`) is sticky-pinned to the left while scrolling.
  - Table headers are sticky-pinned to the top while scrolling vertically.
  - Minimum touch target height of 48px per cell.
- **Actions Bar**:
  - `Import CSV`: Load any CSV or TSV file directly into the session table.
  - `Paste Table`: Modal with textarea to paste rows copied directly from Excel or Google Sheets.
  - `Sample Data`: Quick reset button to restore the 8 sample rows.
  - `Template`: Direct download of `emittr-sheet-template.csv`.
  - `Clear`: Empties the temporary table.
  - Real-time search filter matching rows across all columns.

#### Subview B: Saved Macro Sheets (Persistent)
- Persistent sheets stored on the server (`/api/sheets`).
- Sheet dropdown selector and metadata badge (`X rows • Y cols`).
- Modes:
  - **Fill Mode**: Click-to-type cells and sequential row runners.
  - **Edit Mode**: Add/delete rows, add/delete columns, edit column header names, and update cell values inline.
- Sheet Management: Create new sheet, rename, duplicate, delete, import CSV, and export CSV.

### View 6: Touchpad & Dual Xbox Joysticks
- **Trackpad Surface**: Smooth touch surface tracking single-finger delta movements for USB mouse cursor glide.
- **Gestures**:
  - Tap: Left click.
  - Two-finger glide: Vertical and horizontal scrolling.
- **Physical Mouse Buttons**: Left Click, Middle Click, Right Click bar below the surface.
- **Dual Virtual Thumbstick Dock**:
  - Left Thumbstick: Dedicated vertical scroll stick (tilt up/down to scroll target document or browser).
  - Right Thumbstick: Dedicated horizontal scroll stick (tilt left/right for wide spreadsheets and code).
  - Styled with tactical circular dishes, grip crosses, and directional guidelines.

### Global Components & Modals
- **Header**: Brand logo, version badge, connection status pill, latency indicator (ms), settings gear icon, and Dashboard Mode toggle.
- **Connection Status Modal**: USB gadget status (`configured`, `addressed`, `disconnected`), server uptime, USB vendor/product IDs, WebSockets health, and reconnect button.
- **Settings Modal**: Countdown delay default, typing speed preset, auto-enter toggle, trackpad sensitivity slider, dark/light theme, and Raspberry Pi hardware health (CPU temp, memory usage).
- **Dashboard Mode**: Wide-screen desktop layout displaying Typer, Shortcuts, Macros, and Trackpad simultaneously in a responsive tactical grid.

---

## 5. Backend API & Communication Protocols

The frontend interacts with the FastAPI backend through REST endpoints and a high-speed WebSocket.

### WebSocket Interface: `/ws`
Bi-directional real-time communication for live keystrokes, ping latency, and mouse delta events.
- **Client to Server**:
  - Ping: `{"type": "ping", "ts": 1690000000000}`
  - Live character: `{"action": "live_char", "char": "a"}`
  - Mouse move: `{"action": "mouse_move", "dx": 5, "dy": -3}`
  - Mouse click: `{"action": "mouse_click", "btn": 1}` (1=left, 2=right, 4=middle)
  - Mouse scroll: `{"action": "mouse_scroll", "wheel": 2, "hwheel": 0}`
- **Server to Client**:
  - Pong: `{"type": "pong", "ts": 1690000000000}`
  - Status updates: `{"type": "status", "is_typing": false, ...}`

### Key REST Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/type` | Stream text typing with `text`, `delay_ms`, and `initial_delay_s` |
| `POST` | `/api/stop` | Abort active typing sequence |
| `POST` | `/api/key` | Send single key or combo: `{"combo": "ctrl+alt+t"}` or `{"key": "enter"}` |
| `GET` | `/api/macros` | List all saved macros |
| `POST` | `/api/macros` | Create macro (`name`, `text`, `type`, `category`, `action_after`, `delay_s`) |
| `PUT` | `/api/macros/{id}` | Update existing macro |
| `DELETE` | `/api/macros/{id}` | Delete macro by ID |
| `POST` | `/api/macros/import` | Import macros array with `mode: "merge"` or `"replace"` |
| `GET` | `/api/macros/template.csv` | Download macro CSV template with attachment headers |
| `GET` | `/api/categories` | List macro folders and counts |
| `PUT` | `/api/categories/{old_name}` | Rename category across all macros |
| `DELETE` | `/api/categories/{name}` | Delete category and its macros |
| `GET` | `/api/sheets` | List all persistent macro sheets |
| `POST` | `/api/sheets` | Create sheet (`name`, `columns`, `rows`) |
| `PUT` | `/api/sheets/{id}` | Update sheet columns, rows, or name |
| `DELETE` | `/api/sheets/{id}` | Delete sheet by ID |
| `GET` | `/api/sheets/template.csv` | Download sheet CSV template with attachment headers |
| `GET` | `/api/status` | Hardware status, USB connection state, CPU temperature |

---

## 6. Critical Redesign Rules & Constraints

When redesigning this interface:
1. **Never fit the Temporary Cheat Sheet to page width on mobile**: It must scroll horizontally (`overflow-x: auto`) with a minimum width of 720px so phone numbers, emails, and names are readable without text wrapping or squishing.
2. **Instant Click-to-Type**: Cell clicks in sheets must never trigger confirmation dialogs. A single tap must type the value immediately.
3. **Download Links Must Use Direct URLs**: Always link template downloads to `/api/macros/template.csv` and `/api/sheets/template.csv` with `download` attributes to avoid mobile browser blob UUID bugs.
4. **Touch Targets**: All buttons, macro cards, shortcuts, and sheet cells must adhere to a minimum 44px to 48px touch height target.
5. **Session Data Persistence**: Temporary Cheat Sheet data must remain in memory only and vanish when the user reloads the page.
