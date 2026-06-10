#!/bin/bash
# ==============================================================================
# USB Typer & HID Deck — Standalone Deployment Script  v1.1.0
# ==============================================================================
# FIX Bug 9: removed global "set -e" which caused silent abort when non-critical
# commands like "chmod 666 /dev/hidg*" or "grep /proc/1/root/..." failed.
# Each potentially-failing command is now guarded with "|| true" or wrapped in
# an explicit if-block.

INSTALL_DIR="/opt/usb_hid_deck"
PORT="8088"

echo "[*] Installing USB Typer & HID Deck v1.1.0 to ${INSTALL_DIR}..."

# Abort only on genuinely fatal errors (directory creation, file copy)
mkdir -p "${INSTALL_DIR}" || { echo "[-] Cannot create ${INSTALL_DIR}. Run as root."; exit 1; }

if [ "$(cd "$(dirname "$0")" && pwd)" != "${INSTALL_DIR}" ]; then
    cp -r ./* "${INSTALL_DIR}/" || { echo "[-] File copy failed."; exit 1; }
fi

chmod +x "${INSTALL_DIR}/server.py"
chmod +x "${INSTALL_DIR}/usbtype"

# Link CLI tool to PATH
ln -sf "${INSTALL_DIR}/usbtype" /usr/local/bin/usbtype

# Make HID node writable — non-fatal if gadget isn't enumerated yet
chmod 666 /dev/hidg* 2>/dev/null || true

# Add hid.keyboard hostname to chroot /etc/hosts
if ! grep -q "hid.keyboard" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 hid.keyboard" >> /etc/hosts
    echo "[+] Added hid.keyboard to chroot /etc/hosts"
fi

# Attempt to add to Android system hosts (non-fatal — may be read-only)
if [ -f /proc/1/root/system/etc/hosts ]; then
    if ! grep -q "hid.keyboard" /proc/1/root/system/etc/hosts 2>/dev/null; then
        echo "127.0.0.1 hid.keyboard" >> /proc/1/root/system/etc/hosts 2>/dev/null || true
    fi
fi

# Note: Port 80 redirect is handled entirely in userland by server.py
# (no iptables rules needed; they deadlock Linux 4.4 on loopback traffic)

# Select Python interpreter with FastAPI/Uvicorn
if [ -x "/opt/tactical_venv/bin/python3" ]; then
    PY_BIN="/opt/tactical_venv/bin/python3"
elif [ -x "/usr/bin/python3" ]; then
    PY_BIN="/usr/bin/python3"
else
    PY_BIN="python3"
fi

# Kill any existing instance (non-fatal if none running)
pkill -f "usb_hid_deck/server.py" 2>/dev/null || true
sleep 1

# Launch daemon
echo "[*] Starting USB Typer service on port ${PORT} using ${PY_BIN}..."
nohup "${PY_BIN}" "${INSTALL_DIR}/server.py" > /var/log/usb_deck.log 2>&1 &

sleep 2

# Health check — uses "hid_node" (v1.1.0) with fallback to "kbd_node" (v1.0.0)
if curl -s "http://127.0.0.1:${PORT}/api/status" | grep -qE '"hid_node"|"kbd_node"'; then
    echo "[+] USB Typer is ONLINE and HEALTHY!"
    echo "    Local URL:   http://localhost:${PORT} or http://hid.keyboard"
    echo "    Network URL: http://$(hostname -I | awk '{print $1}'):${PORT}"
    echo "    CLI Tool:    usbtype \"Hello PC\""
else
    echo "[-] Warning: Server started but health check inconclusive. Check /var/log/usb_deck.log"
fi
