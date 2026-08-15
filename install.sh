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

# Prevent Android framework from reverting USB to mass_storage
/system/bin/setprop persist.sys.usb.config none 2>/dev/null || true
/system/bin/setprop sys.usb.config none 2>/dev/null || true

# Initialize composite HID gadget
if [ -x "/opt/tactical_venv/bin/python3" ]; then
    PY_BIN="/opt/tactical_venv/bin/python3"
elif [ -x "/usr/bin/python3" ]; then
    PY_BIN="/usr/bin/python3"
else
    PY_BIN="python3"
fi

"${PY_BIN}" "${INSTALL_DIR}/setup_gadget.py" || true
chmod 666 /dev/hidg* 2>/dev/null || true

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
nohup "${PY_BIN}" "${INSTALL_DIR}/server.py" > /var/log/usb_deck.log 2>&1 &

sleep 2

# Health check
if curl -s "http://127.0.0.1:${PORT}/api/status" | grep -qE '"hid_node"|"version"'; then
    echo "[+] Emittr v1.3.0 is ONLINE and HEALTHY!"
    echo "    Local URL:   http://localhost:${PORT} or http://hid.keyboard"
    echo "    Network URL: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
    echo "    CLI Tool:    usbtype --help"
else
    echo "[-] Warning: Server started but health check inconclusive. Check /var/log/usb_deck.log"
fi
