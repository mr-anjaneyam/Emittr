#!/bin/bash
# ==============================================================================
# Emittr — Tactical USB HID Controller Deployment Script  v1.3.0
# ==============================================================================

INSTALL_DIR="/opt/usb_hid_deck"
PORT="8088"

echo "[*] Installing Emittr v1.3.0 to ${INSTALL_DIR}..."

# Abort only on genuinely fatal errors
mkdir -p "${INSTALL_DIR}" || { echo "[-] Cannot create ${INSTALL_DIR}. Run as root."; exit 1; }

if [ "$(cd "$(dirname "$0")" && pwd)" != "${INSTALL_DIR}" ]; then
    cp -r ./* "${INSTALL_DIR}/" || { echo "[-] File copy failed."; exit 1; }
fi

chmod +x "${INSTALL_DIR}/server.py"
chmod +x "${INSTALL_DIR}/setup_gadget.py"
chmod +x "${INSTALL_DIR}/02-usb-deck.sh"
chmod +x "${INSTALL_DIR}/usbtype"

# Link CLI tool to PATH
ln -sf "${INSTALL_DIR}/usbtype" /usr/local/bin/usbtype

# Skip forcing HID mode if the user previously toggled it off from the web UI/settings
# (mirrors NetHunter's own USB-function switch instead of overriding it on every install).
HID_MODE_FILE="${INSTALL_DIR}/.emittr_hid_mode"
if [ ! -f "${HID_MODE_FILE}" ] || [ "$(cat "${HID_MODE_FILE}" 2>/dev/null)" != "0" ]; then
    # Prevent Android framework from reverting USB to mass_storage
    /system/bin/setprop persist.sys.usb.config none 2>/dev/null || true
    /system/bin/setprop sys.usb.config none 2>/dev/null || true
fi

# Initialize composite HID gadget
if [ -x "/opt/tactical_venv/bin/python3" ]; then
    PY_BIN="/opt/tactical_venv/bin/python3"
elif [ -x "/usr/bin/python3" ]; then
    PY_BIN="/usr/bin/python3"
else
    PY_BIN="python3"
fi

if [ ! -f "${HID_MODE_FILE}" ] || [ "$(cat "${HID_MODE_FILE}" 2>/dev/null)" != "0" ]; then
    "${PY_BIN}" "${INSTALL_DIR}/setup_gadget.py" || true
    chmod 660 /dev/hidg* 2>/dev/null || true
fi

# Add hid.keyboard hostname to chroot /etc/hosts
if ! grep -q "hid.keyboard" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 hid.keyboard" >> /etc/hosts
    echo "[+] Added hid.keyboard to chroot /etc/hosts"
fi

# Attempt to add to Android system hosts
if [ -f /proc/1/root/system/etc/hosts ]; then
    if ! grep -q "hid.keyboard" /proc/1/root/system/etc/hosts 2>/dev/null; then
        echo "127.0.0.1 hid.keyboard" >> /proc/1/root/system/etc/hosts 2>/dev/null || true
    fi
fi

# Kill any existing instance
pkill -f "usb_hid_deck/server.py" 2>/dev/null || true
sleep 1

# Launch daemon
echo "[*] Starting Emittr service on port ${PORT} using ${PY_BIN}..."
# server.py owns its own rotating log file (/var/log/usb_deck.log); stdout is
# discarded here to avoid a second, non-rotating writer targeting the same path.
nohup "${PY_BIN}" "${INSTALL_DIR}/server.py" > /dev/null 2>> /var/log/usb_deck.crash.log &

# Health check — poll instead of a fixed sleep so slow-booting devices aren't
# falsely reported as failed, while fast devices don't wait unnecessarily.
HEALTHY=0
for i in $(seq 1 15); do
    sleep 1
    if curl -s "http://127.0.0.1:${PORT}/api/status" | grep -qE '"hid_node"|"version"'; then
        HEALTHY=1
        break
    fi
done

if [ "${HEALTHY}" -eq 1 ]; then
    echo "[+] Emittr v1.3.0 is ONLINE and HEALTHY!"
    echo "    Local URL:   http://localhost:${PORT} or http://hid.keyboard"
    echo "    Network URL: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
    echo "    CLI Tool:    usbtype --help"
else
    echo "[-] Warning: Server did not respond healthy within 15s. Check /var/log/usb_deck.log"
fi
