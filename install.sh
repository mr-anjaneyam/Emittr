#!/bin/bash
# ==============================================================================
# USB Typer & HID Deck — Standalone Deployment Script
# ==============================================================================
set -e

INSTALL_DIR="/opt/usb_hid_deck"
PORT="8088"

echo "[*] Installing USB Typer & HID Deck to ${INSTALL_DIR}..."

mkdir -p "${INSTALL_DIR}"
if [ "$(cd "$(dirname "$0")" && pwd)" != "${INSTALL_DIR}" ]; then
    cp -r ./* "${INSTALL_DIR}/"
fi
chmod +x "${INSTALL_DIR}/server.py"
chmod +x "${INSTALL_DIR}/usbtype"

# Link CLI to /usr/local/bin
ln -sf "${INSTALL_DIR}/usbtype" /usr/local/bin/usbtype

# Ensure /dev/hidg permissions
chmod 666 /dev/hidg* 2>/dev/null || true

# Add local hostname resolution for hid.keyboard
if ! grep -q "hid.keyboard" /etc/hosts; then
    echo "127.0.0.1 hid.keyboard" >> /etc/hosts
    echo "[+] Added hid.keyboard to /etc/hosts"
fi

if [ -f /proc/1/root/system/etc/hosts ]; then
    if ! grep -q "hid.keyboard" /proc/1/root/system/etc/hosts 2>/dev/null; then
        echo "127.0.0.1 hid.keyboard" >> /proc/1/root/system/etc/hosts 2>/dev/null || true
    fi
fi

# Note: Port 80 redirect is handled natively in userland by server.py (no iptables rules needed)

# Select Python interpreter with FastAPI/Uvicorn
if [ -x "/opt/tactical_venv/bin/python3" ]; then
    PY_BIN="/opt/tactical_venv/bin/python3"
elif [ -x "/usr/bin/python3" ]; then
    PY_BIN="/usr/bin/python3"
else
    PY_BIN="python3"
fi

# Kill any existing instance
pkill -f "usb_hid_deck/server.py" 2>/dev/null || true
sleep 1

# Launch daemon in background
echo "[*] Starting USB Typer service on port ${PORT} using ${PY_BIN}..."
nohup "${PY_BIN}" "${INSTALL_DIR}/server.py" > /var/log/usb_deck.log 2>&1 &

sleep 2

# Verify health
if curl -s "http://127.0.0.1:${PORT}/api/status" | grep -q "kbd_node"; then
    echo "[+] USB Typer is ONLINE and HEALTHY!"
    echo "    Local URL:   http://localhost:${PORT} or http://hid.keyboard"
    echo "    Network URL: http://$(hostname -I | awk '{print $1}'):${PORT}"
    echo "    CLI Tool:    usbtype \"Hello PC\""
else
    echo "[-] Warning: Server started but health check pending. Check /var/log/usb_deck.log"
fi
