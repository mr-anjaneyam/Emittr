#!/usr/bin/env python3
"""
setup_gadget.py  —  USB Composite HID Gadget Initializer  v1.1.0
==================================================================
Configures a composite USB HID device via Linux configfs:
  - Report ID 1: Keyboard  (standard 8-byte boot report)
  - Report ID 2: Mouse     (buttons, dx, dy, wheel)

All I/O goes to a single /dev/hidg0 node.
Must be run as root inside the NetHunter chroot.
"""

import os
import sys
import time

GADGET = "/config/usb_gadget/g1"


# ── Pre-flight check ──────────────────────────────────────────────────────────
if not os.path.exists("/config/usb_gadget"):
    print(
        "ERROR: /config/usb_gadget does not exist.\n"
        "       Make sure configfs is mounted:\n"
        "         mount -t configfs none /config\n"
        "       and the g_hid / usb_f_hid kernel module is loaded.",
        file=sys.stderr,
    )
    sys.exit(1)

# Create gadget dir if it doesn't exist yet
os.makedirs(GADGET, exist_ok=True)


# ── 1. Unbind UDC (safe no-op if already unbound) ────────────────────────────
try:
    with open(f"{GADGET}/UDC", "w") as f:
        f.write("none\n")
except Exception as e:
    print(f"Unbind warning (non-fatal): {e}")

time.sleep(0.2)


# ── 2. Clear old function symlinks from config ────────────────────────────────
configs_dir = f"{GADGET}/configs/b.1"
try:
    for fname in os.listdir(configs_dir):
        if fname.startswith("f"):
            try:
                os.unlink(f"{configs_dir}/{fname}")
            except Exception:
                pass
except Exception as e:
    print(f"Warning listing configs_dir (non-fatal): {e}")


# ── 3. VID & PID ─────────────────────────────────────────────────────────────
# 0x1d6b = Linux Foundation, 0x010a = composite HID
with open(f"{GADGET}/idVendor",  "w") as f:
    f.write("0x1d6b\n")
with open(f"{GADGET}/idProduct", "w") as f:
    f.write("0x010a\n")


# ── 4. Create composite HID function ─────────────────────────────────────────
kbd_dir = f"{GADGET}/functions/hid.0"
os.makedirs(kbd_dir, exist_ok=True)

# Protocol 0 = None (custom descriptor), Subclass 0 = None
with open(f"{kbd_dir}/protocol",     "w") as f:
    f.write("0\n")
with open(f"{kbd_dir}/subclass",     "w") as f:
    f.write("0\n")
# report_length = 9 bytes (1 Report-ID byte + 8 keyboard payload) — accommodates both reports
with open(f"{kbd_dir}/report_length","w") as f:
    f.write("9\n")

# Composite HID Report Descriptor
#   Report ID 1 — Keyboard: modifiers (8×1-bit), reserved (8-bit), 6 keycodes (8-bit each)
#   Report ID 2 — Mouse:    buttons (5-bit + 3-bit pad), dx (signed 8-bit), dy, wheel
composite_desc = bytes.fromhex(
    "05010906a1018501050719e029e71500250175019508"
    "81029501750881039505750105081901290591029501"
    "7503910395067508150025650507190029658100c0"
    "05010902a10185020901a10005091901290515002501"
    "95057501810295017503810305010930093109381581"
    "257f750895038106c0c0"
)

with open(f"{kbd_dir}/report_desc", "wb") as f:
    f.write(composite_desc)


# ── 5. Link function into configuration ───────────────────────────────────────
f1_path = f"{configs_dir}/f1"
if os.path.exists(f1_path) or os.path.islink(f1_path):
    try:
        os.unlink(f1_path)
    except Exception:
        pass
os.symlink(f"{GADGET}/functions/hid.0", f1_path)


# ── 6. Bind UDC ───────────────────────────────────────────────────────────────
try:
    with open(f"{GADGET}/UDC", "w") as f:
        f.write("hisi-usb-otg\n")
except Exception as e:
    print(f"UDC bind warning: {e}")

time.sleep(0.3)

# Make HID node world-writable so the server process can write without being root
ret = os.system("chmod 666 /dev/hidg* 2>/dev/null")
if ret != 0:
    print("Note: chmod /dev/hidg* failed — /dev/hidg0 may not exist yet (gadget not enumerated).")

print("Composite HID Gadget v1.1.0 ready: Keyboard (ID 1) + Mouse (ID 2) on /dev/hidg0")
