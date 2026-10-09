# Getting Support for Emittr ⚡

Need help setting up Emittr, running custom kernels, or troubleshooting USB HID gadget states? Here's where to find assistance.

---

## 🧭 Channels & Resources

* 📖 **[Official Documentation](https://mr-anjaneyam.github.io/Emittr/)**: Complete quickstart guides, architectural deep-dives, and use cases.
* 💬 **[GitHub Discussions](https://github.com/mr-anjaneyam/Emittr/discussions)**: Best for general questions, setup advice, hardware recommendations, and sharing your cyberdeck builds.
* 🐛 **[GitHub Issues](https://github.com/mr-anjaneyam/Emittr/issues)**: For verified bugs, kernel crash reports, and technical feature requests.
* 📱 **[Compatibility Reports](https://github.com/mr-anjaneyam/Emittr/issues?q=label%3Ahardware-compatibility)**: Check if your specific phone model and kernel version have been tested by the community.

---

## 🛠️ Top 5 Troubleshooting Quick Fixes

### 1. Host PC doesn't detect any keyboard or mouse
* **The Cause:** 90% of the time, the cable is a **charge-only cable** (missing D+/D- data lines).
* **The Fix:** Swap for a high-quality data cable or a verified USB-OTG adapter. Also verify `/sys/class/udc/*/state` reads `configured`.

### 2. Android reverts to `mass_storage` or MTP on disconnect
* **The Cause:** Android's internal `UsbDeviceManager` service tries to restore phone charging or file transfer modes.
* **The Fix:** Emittr runs a built-in watchdog that re-applies ConfigFS bindings automatically. You can also run:
  ```bash
  su -c "setprop persist.sys.usb.config none && setprop sys.usb.config none"
  ```

### 3. Permission denied writing to `/dev/hidg0`
* **The Cause:** Android SELinux policy or restrictive device node permissions.
* **The Fix:**
  ```bash
  su -c "chmod 666 /dev/hidg*"
  # If SELinux is blocking:
  su -c "setenforce 0"
  ```

### 4. Keys are stuck down or typing repeatedly
* **The Cause:** Cable was unplugged while a key report was active.
* **The Fix:** Tap the **Unstick** button in the Web Deck header, or run `usbtype --release` from the command line. This immediately transmits a 9-byte null report.

### 5. Cannot access the Web Deck on `http://<phone-ip>:8088` from another device
* **The Cause:** Android firewall (iptables) or AP isolation on the Wi-Fi router.
* **The Fix:** Ensure both devices are on the same Wi-Fi subnet, or turn on the phone's portable Wi-Fi Hotspot and connect your other device directly to it.
