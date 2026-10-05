#!/bin/bash
# ==============================================================================
# Emittr - Tactical USB HID Controller Deployment Script  v1.3.0
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
chmod +x "${INSTALL_DIR}/emittr"

# Link CLI commands globally to PATH (works from anywhere in the terminal)
ln -sf "${INSTALL_DIR}/emittr" /usr/local/bin/emittr
ln -sf "${INSTALL_DIR}/emittr" /usr/bin/emittr
ln -sf "${INSTALL_DIR}/usbtype" /usr/local/bin/usbtype
ln -sf "${INSTALL_DIR}/usbtype" /usr/bin/usbtype

# Expose to Termux bin if present
if [ -d "/data/data/com.termux/files/usr/bin" ]; then
    ln -sf "${INSTALL_DIR}/emittr" /data/data/com.termux/files/usr/bin/emittr 2>/dev/null || true
    ln -sf "${INSTALL_DIR}/usbtype" /data/data/com.termux/files/usr/bin/usbtype 2>/dev/null || true
fi

# Expose wrapper to Android host /system/bin if writable
if [ -w /proc/1/root/system/bin ]; then
    cat << 'EOF' > /proc/1/root/system/bin/emittr
#!/system/bin/sh
if [ -f /data/local/nhsystem/bin/bootkali ]; then
    exec /data/local/nhsystem/bin/bootkali /opt/usb_hid_deck/emittr "$@"
else
    exec /opt/usb_hid_deck/emittr "$@"
fi
EOF
    chmod +x /proc/1/root/system/bin/emittr 2>/dev/null || true
fi

# Prevent Android framework from reverting USB to mass_storage
/system/bin/setprop persist.sys.usb.config none 2>/dev/null || true
/system/bin/setprop sys.usb.config none 2>/dev/null || true

# Add emittr hostname to chroot /etc/hosts
for HOST_NAME in "emittr" "emittr.local" "hid.keyboard"; do
    if ! grep -qw "${HOST_NAME}" /etc/hosts 2>/dev/null; then
        echo "127.0.0.1 ${HOST_NAME}" >> /etc/hosts
        echo "[+] Added ${HOST_NAME} to chroot /etc/hosts"
    fi
done

# Attempt to add emittr to Android system hosts (accessible across all Android browsers/apps)
if [ -f /proc/1/root/system/etc/hosts ]; then
    for HOST_NAME in "emittr" "emittr.local" "hid.keyboard"; do
        if ! grep -qw "${HOST_NAME}" /proc/1/root/system/etc/hosts 2>/dev/null; then
            echo "127.0.0.1 ${HOST_NAME}" >> /proc/1/root/system/etc/hosts 2>/dev/null || true
            echo "[+] Added ${HOST_NAME} to Android /system/etc/hosts"
        fi
    done
fi

# Setup iptables loopback port 80 -> 8088 redirection (failsafe for instant emittr/ typing)
iptables -t nat -A PREROUTING -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port ${PORT} 2>/dev/null || true
iptables -t nat -A OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-port ${PORT} 2>/dev/null || true

# Stop any older manual instances
pkill -f "usb_hid_deck/server.py" 2>/dev/null || true
sleep 1

# Launch daemon using the standard emittr CLI tool
echo "[*] Launching Emittr service via standard CLI..."
"${INSTALL_DIR}/emittr" start

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  [+] Global CLI installed! You can now run from anywhere:"
echo "      • emittr start     - Start daemon & port 80 redirect"
echo "      • emittr stop      - Stop daemon & flush keys"
echo "      • emittr status    - Show service & active IP addresses"
echo "      • emittr ip        - Print all device IPs & URLs"
echo "      • emittr logs      - Stream or view logs"
echo "      • usbtype          - Inject text directly via CLI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
