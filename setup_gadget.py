#!/usr/bin/env python3
"""
setup_gadget.py  —  Emittr Composite USB HID Gadget Initializer  v1.3.0
========================================================================
Configures a unified composite USB HID device via Linux configfs:
  - Report ID 1: Keyboard  (standard boot report + modifier keys, 9 bytes)
  - Report ID 2: Mouse     (buttons, dx, dy, wheel, ac_pan, 6 bytes)

Native AC Pan (Consumer Usage 0x0238) provides standard hardware horizontal
scrolling (WM_MOUSEHWHEEL) across Windows, Linux, and macOS without key hacks.

All I/O routes through /dev/hidg0.
Prevents Android NetHunter from reverting USB config to mass_storage / mtp.
"""

import os
import sys
import time

GADGET = "/config/usb_gadget/g1"


def init_gadget(force: bool = False) -> bool:
    """Initialize or restore the composite HID gadget."""
    # Ensure configfs is mounted
    if not os.path.exists("/config/usb_gadget"):
        os.system("mkdir -p /config && mount -t configfs none /config 2>/dev/null")
        if not os.path.exists("/config/usb_gadget"):
            print("ERROR: /config/usb_gadget does not exist. Mount configfs first.", file=sys.stderr)
            return False

    os.makedirs(GADGET, exist_ok=True)

    # 1. Suppress Android framework from hijacking USB back to mass_storage
    os.system("/system/bin/setprop persist.sys.usb.config none 2>/dev/null")
    os.system("/system/bin/setprop sys.usb.config none 2>/dev/null")

    # 2. Unbind UDC (safe no-op if unbound)
    try:
        if os.path.exists(f"{GADGET}/UDC"):
            with open(f"{GADGET}/UDC", "w") as f:
                f.write("none\n")
    except Exception as e:
        print(f"Unbind warning (non-fatal): {e}")

    time.sleep(0.15)

    # 3. Clear old function symlinks from config
    configs_dir = f"{GADGET}/configs/b.1"
    os.makedirs(configs_dir, exist_ok=True)
    try:
        for fname in os.listdir(configs_dir):
            if fname.startswith("f"):
                try:
                    os.unlink(f"{configs_dir}/{fname}")
                except Exception:
                    pass
    except Exception as e:
        print(f"Warning clearing configs_dir (non-fatal): {e}")

    # 4. Set VID & PID (Linux Foundation Composite HID)
    try:
        with open(f"{GADGET}/idVendor", "w") as f:
            f.write("0x1d6b\n")
        with open(f"{GADGET}/idProduct", "w") as f:
            f.write("0x010a\n")
    except Exception as e:
        print(f"VID/PID write error: {e}")

    # 5. Create composite HID function hid.0
    kbd_dir = f"{GADGET}/functions/hid.0"
    os.makedirs(kbd_dir, exist_ok=True)

    with open(f"{kbd_dir}/protocol", "w") as f:
        f.write("0\n")
    with open(f"{kbd_dir}/subclass", "w") as f:
        f.write("0\n")
    with open(f"{kbd_dir}/report_length", "w") as f:
        f.write("9\n")

    # Composite HID Report Descriptor:
    # Report ID 1: Keyboard (9 bytes total with Report ID)
    # Report ID 2: Mouse    (6 bytes total: buttons, dx, dy, wheel, ac_pan)
    composite_desc = bytes.fromhex(
        "05010906a1018501050719e029e71500250175019508"
        "81029501750881039505750105081901290591029501"
        "7503910395067508150025650507190029658100c0"
        "05010902a10185020901a10005091901290515002501"
        "95057501810295017503810305010930093109381581"
        "257f750895038106050c0a38021581257f750895018106c0c0"
    )

    with open(f"{kbd_dir}/report_desc", "wb") as f:
        f.write(composite_desc)

    # 6. Link function into config b.1/f1
    f1_path = f"{configs_dir}/f1"
    if os.path.exists(f1_path) or os.path.islink(f1_path):
        try:
            os.unlink(f1_path)
        except Exception:
            pass
    os.symlink(f"{GADGET}/functions/hid.0", f1_path)

    # 7. Bind UDC
    try:
        with open(f"{GADGET}/UDC", "w") as f:
            f.write("hisi-usb-otg\n")
    except Exception as e:
        print(f"UDC bind warning: {e}")

    time.sleep(0.2)

    # Ensure device node permissions
    os.system("chmod 666 /dev/hidg* 2>/dev/null")

    print("Emittr Composite HID Gadget v1.3.0 ready on /dev/hidg0")
    return True


if __name__ == "__main__":
    success = init_gadget()
    sys.exit(0 if success else 1)
