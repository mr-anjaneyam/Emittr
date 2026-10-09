#!/usr/bin/env python3
"""
setup_gadget.py  -  Emittr Composite USB HID Gadget Initializer  v2.0.0
========================================================================
Configures a unified composite USB HID device via Linux kernel configfs:
  - Report ID 1: Keyboard  (standard boot report + modifier keys, 9 bytes)
  - Report ID 2: Mouse     (buttons, dx, dy, wheel, ac_pan, 6 bytes)

Native AC Pan (Consumer Usage 0x0238) provides standard hardware horizontal
scrolling (WM_MOUSEHWHEEL) across Windows, Linux, and macOS without key hacks.

Hardware Compatibility:
  - Dynamically discovers hardware UDC across Qualcomm Snapdragon, MediaTek,
    Samsung Exynos, Google Tensor, HiSilicon, Rockchip, Allwinner, and Raspberry Pi.
  - Automatically unbinds any conflicting Android gadgets to prevent EBUSY.
  - Dual ConfigFS root support (/config/usb_gadget and /sys/kernel/config/usb_gadget).
  - Automatically writes complete USB 0x409 string descriptors for universal host recognition.
  - Automatically recovers missing /dev/hidg* device nodes via major:minor device numbers.
"""

import os
import sys
import time
import glob
from pathlib import Path
from typing import Optional


def get_configfs_root() -> Optional[str]:
    """Find or mount the USB gadget configfs directory."""
    # Ensure kernel modules are loaded if built as modules
    os.system("modprobe libcomposite 2>/dev/null || true")
    os.system("modprobe usb_f_hid 2>/dev/null || true")

    candidates = [
        "/config/usb_gadget",
        "/sys/kernel/config/usb_gadget",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c

    # Attempt to mount /config
    os.system("mkdir -p /config && mount -t configfs none /config 2>/dev/null")
    if os.path.exists("/config/usb_gadget"):
        return "/config/usb_gadget"

    # Attempt to mount /sys/kernel/config
    os.system("mkdir -p /sys/kernel/config && mount -t configfs none /sys/kernel/config 2>/dev/null")
    if os.path.exists("/sys/kernel/config/usb_gadget"):
        os.system("ln -sf /sys/kernel/config /config 2>/dev/null")
        return "/sys/kernel/config/usb_gadget"

    return None


def get_hardware_udc() -> Optional[str]:
    """
    Auto-detect the phone's actual USB Device Controller (UDC).
    Supports:
      - Qualcomm Snapdragon (a600000.dwc3, 7000000.dwc3, msm_hsusb, ci_hdrc.0)
      - MediaTek (musb-hdrc, 11200000.usb, 11271000.usb)
      - Samsung Exynos (10ee0000.usb, 13200000.usb, exynos-dwc3)
      - Google Tensor (11210000.dwc3, 11110000.dwc3)
      - HiSilicon Kirin (hisi-usb-otg)
      - Rockchip & Allwinner (fe800000.dwc3, dwc2)
      - Raspberry Pi (fe980000.usb, 20980000.usb, dwc2)
    """
    # 1. Query /sys/class/udc/ (standard modern Linux kernel)
    try:
        udc_dir = Path("/sys/class/udc")
        if udc_dir.exists():
            controllers = [p.name for p in udc_dir.iterdir() if not p.name.startswith(".")]
            if controllers:
                return controllers[0]
    except Exception:
        pass

    # 2. Query Android system property (sys.usb.controller)
    try:
        for prop_cmd in ("/system/bin/getprop sys.usb.controller", "getprop sys.usb.controller"):
            prop = os.popen(f"{prop_cmd} 2>/dev/null").read().strip()
            if prop:
                return prop
    except Exception:
        pass

    # 3. Dynamic device-tree search across sysfs bus platforms
    dt_patterns = [
        "/sys/bus/platform/drivers/*dwc3*/*udc*",
        "/sys/bus/platform/drivers/*musb*/*udc*",
        "/sys/bus/platform/drivers/*usb*/*udc*",
        "/sys/devices/platform/soc/*.dwc3/udc/*",
        "/sys/devices/platform/*.dwc3/udc/*",
        "/sys/devices/soc/*.dwc3/udc/*",
        "/sys/devices/platform/soc/*.usb/udc/*",
        "/sys/devices/hisi-usb-otg/udc/hisi-usb-otg",
    ]
    for pattern in dt_patterns:
        matches = glob.glob(pattern)
        if matches:
            return os.path.basename(matches[0])

    return None


def init_gadget(force: bool = False) -> bool:
    """Initialize or restore the composite HID gadget."""
    root = get_configfs_root()
    if not root:
        print("[-] ERROR: Cannot locate or mount USB Gadget ConfigFS.", file=sys.stderr)
        print("    Ensure your Android kernel has CONFIG_USB_CONFIGFS=y enabled.", file=sys.stderr)
        return False

    gadget_dir = f"{root}/g1"
    os.makedirs(gadget_dir, exist_ok=True)

    # 1. Suppress Android framework from hijacking USB back to MTP/charge
    os.system("/system/bin/setprop persist.sys.usb.config none 2>/dev/null")
    os.system("/system/bin/setprop sys.usb.config none 2>/dev/null")
    os.system("setprop persist.sys.usb.config none 2>/dev/null")
    os.system("setprop sys.usb.config none 2>/dev/null")

    # 2. Unbind ANY gadget currently holding a UDC to prevent EBUSY
    try:
        for entry in os.listdir(root):
            entry_udc = os.path.join(root, entry, "UDC")
            if os.path.exists(entry_udc):
                try:
                    with open(entry_udc, "r") as f:
                        bound = f.read().strip()
                    if bound:
                        try:
                            with open(entry_udc, "w") as f:
                                f.write("none\n")
                        except Exception:
                            with open(entry_udc, "w") as f:
                                f.write("\n")
                except Exception:
                    pass
    except Exception:
        pass

    time.sleep(0.1)

    # 3. Clear existing functions from configuration b.1
    configs_dir = f"{gadget_dir}/configs/b.1"
    os.makedirs(configs_dir, exist_ok=True)
    try:
        for fname in os.listdir(configs_dir):
            if fname.startswith("f"):
                try:
                    os.unlink(f"{configs_dir}/{fname}")
                except Exception:
                    pass
    except Exception as e:
        print(f"[*] Note clearing configs: {e}")

    # 4. Configure Device Vendor & Product IDs (Emittr Composite HID)
    # Using VID 0x1d6b and PID 0x010a provides universal HID compatibility across
    # Android (phones, tablets, TV), Windows, Linux, and macOS hosts.
    try:
        with open(f"{gadget_dir}/idVendor", "w") as f:
            f.write("0x1d6b\n")  # Linux Foundation
        with open(f"{gadget_dir}/idProduct", "w") as f:
            f.write("0x010a\n")  # Emittr Composite HID (restores Android & Windows host compatibility)
        with open(f"{gadget_dir}/bcdDevice", "w") as f:
            f.write("0x0100\n")
        with open(f"{gadget_dir}/bcdUSB", "w") as f:
            f.write("0x0200\n")
    except Exception as e:
        print(f"[*] Note writing IDs: {e}")

    # 5. Write USB String Descriptors (English US 0x409)
    strings_dir = f"{gadget_dir}/strings/0x409"
    os.makedirs(strings_dir, exist_ok=True)
    try:
        with open(f"{strings_dir}/serialnumber", "w") as f:
            f.write("EMITTR-0001\n")
        with open(f"{strings_dir}/manufacturer", "w") as f:
            f.write("Emittr\n")
        with open(f"{strings_dir}/product", "w") as f:
            f.write("Emittr Composite HID Keyboard & Mouse\n")
    except Exception as e:
        print(f"[*] Note writing strings: {e}")

    # 6. Configure Configuration Strings & Power Attributes
    # MaxPower is set to 2mA (low-power profile). Android OTG hosts (phones, tabs, TV)
    # enforce a strict 100mA bus power budget and reject configurations exceeding it.
    cfg_strings = f"{configs_dir}/strings/0x409"
    os.makedirs(cfg_strings, exist_ok=True)
    try:
        with open(f"{cfg_strings}/configuration", "w") as f:
            f.write("Config 1: Composite HID\n")
        with open(f"{configs_dir}/MaxPower", "w") as f:
            f.write("2\n")  # 2mA (universally accepted without bus-power rejection)
    except Exception as e:
        print(f"[*] Note writing config strings: {e}")

    # 7. Create composite HID function hid.0
    hid_dir = f"{gadget_dir}/functions/hid.0"
    try:
        os.makedirs(hid_dir, exist_ok=True)
    except Exception as e:
        print(f"[-] ERROR: Failed creating HID function directory {hid_dir}: {e}", file=sys.stderr)
        print("    Kernel missing CONFIG_USB_CONFIGFS_F_HID=y or usb_f_hid module.", file=sys.stderr)
        return False

    try:
        with open(f"{hid_dir}/protocol", "w") as f:
            f.write("0\n")
        with open(f"{hid_dir}/subclass", "w") as f:
            f.write("0\n")
        with open(f"{hid_dir}/report_length", "w") as f:
            f.write("9\n")
    except Exception as e:
        print(f"[-] Error configuring HID protocol: {e}")
        return False

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

    try:
        with open(f"{hid_dir}/report_desc", "wb") as f:
            f.write(composite_desc)
    except Exception as e:
        print(f"[-] Error writing HID report descriptor: {e}")
        return False

    # 8. Link function into config b.1/f1
    f1_path = f"{configs_dir}/f1"
    if os.path.exists(f1_path) or os.path.islink(f1_path):
        try:
            os.unlink(f1_path)
        except Exception:
            pass
    try:
        os.symlink(hid_dir, f1_path)
    except Exception as e:
        print(f"[-] Failed to link function to config: {e}")
        return False

    # 9. Dynamically discover and bind the hardware UDC
    udc = get_hardware_udc()
    if not udc:
        print("[-] WARNING: Could not auto-detect hardware UDC controller.", file=sys.stderr)
        print("    Check available controllers under /sys/class/udc/", file=sys.stderr)
        return False

    udc_file = f"{gadget_dir}/UDC"
    try:
        with open(udc_file, "w") as f:
            f.write(f"{udc}\n")
        print(f"[+] Successfully bound composite gadget to hardware UDC: {udc}")
    except Exception as e:
        print(f"[-] Error binding UDC '{udc}': {e}", file=sys.stderr)
        return False

    time.sleep(0.2)

    # 10. Auto-recover missing device nodes using ConfigFS major:minor
    dev_info_file = f"{hid_dir}/dev"
    if os.path.exists(dev_info_file) and not os.path.exists("/dev/hidg0"):
        try:
            with open(dev_info_file, "r") as f:
                major_minor = f.read().strip()
            if ":" in major_minor:
                maj, min_num = major_minor.split(":", 1)
                os.system(f"mknod /dev/hidg0 c {maj} {min_num} 2>/dev/null || true")
        except Exception:
            pass

    # 11. Ensure permissions and SELinux context on created character device nodes
    os.system("chmod 666 /dev/hidg* 2>/dev/null || true")
    os.system("/system/bin/chmod 666 /dev/hidg* 2>/dev/null || true")
    os.system("chcon u:object_r:hid_device:s0 /dev/hidg* 2>/dev/null || true")

    if os.path.exists("/dev/hidg0"):
        print("[+] Emittr Composite HID Gadget ready on /dev/hidg0")
        return True
    else:
        nodes = glob.glob("/dev/hidg*")
        if nodes:
            print(f"[+] Emittr HID nodes available: {', '.join(nodes)}")
            return True
        print("[-] Warning: UDC bound but /dev/hidg0 not yet visible.")
        return True


if __name__ == "__main__":
    success = init_gadget()
    sys.exit(0 if success else 1)
