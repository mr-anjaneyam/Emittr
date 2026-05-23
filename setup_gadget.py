#!/usr/bin/env python3
import os
import time

GADGET = "/config/usb_gadget/g1"

# 1. Unbind UDC
try:
    with open(f"{GADGET}/UDC", "w") as f:
        f.write("none\n")
except Exception as e:
    print("Unbind warning:", e)

time.sleep(0.2)

# 2. Clear old symlinks
configs_dir = f"{GADGET}/configs/b.1"
try:
    for fname in os.listdir(configs_dir):
        if fname.startswith("f"):
            try:
                os.unlink(f"{configs_dir}/{fname}")
            except Exception:
                pass
except Exception as e:
    print("Warning listing configs_dir:", e)

# 3. VID & PID (0x1d6b / 0x010a)
with open(f"{GADGET}/idVendor", "w") as f:
    f.write("0x1d6b\n")
with open(f"{GADGET}/idProduct", "w") as f:
    f.write("0x010a\n")

# 4. Composite Keyboard + Mouse (hid.0)
kbd_dir = f"{GADGET}/functions/hid.0"
os.makedirs(kbd_dir, exist_ok=True)
with open(f"{kbd_dir}/protocol", "w") as f:
    f.write("0\n")
with open(f"{kbd_dir}/subclass", "w") as f:
    f.write("0\n")
with open(f"{kbd_dir}/report_length", "w") as f:
    f.write("9\n")

# Report ID 1 = Keyboard (8 bytes payload)
# Report ID 2 = Mouse (4 bytes payload: buttons, dx, dy, wheel)
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

# 5. Link single composite function
f1_path = f"{configs_dir}/f1"
if os.path.exists(f1_path) or os.path.islink(f1_path):
    try:
        os.unlink(f1_path)
    except Exception:
        pass
os.symlink(f"{GADGET}/functions/hid.0", f1_path)

# 6. Bind UDC
with open(f"{GADGET}/UDC", "w") as f:
    f.write("hisi-usb-otg\n")

time.sleep(0.3)
os.system("chmod 666 /dev/hidg* 2>/dev/null")
print("Composite Gadget (Keyboard ID 1 + Mouse ID 2) ready.")
