#!/usr/bin/env bash
# ==============================================================================
# Emittr - Universal USB HID Controller Deployment Script  v2.0.0
# ==============================================================================
# Supports: Kali NetHunter chroot, Termux (with root), standalone Magisk/KernelSU,
#           and standard Linux SBCs (Raspberry Pi, Orange Pi).
# ==============================================================================

# If executed directly in Android host shell (/system/bin/sh without bash):
if [ -z "$BASH_VERSION" ]; then
    if [ -f /data/local/nhsystem/bin/bootkali ]; then
        echo "[*] NetHunter detected. Forwarding deployment into Kali chroot..."
        exec /data/local/nhsystem/bin/bootkali bash "$0" "$@"
    elif command -v bash >/dev/null 2>&1; then
        exec bash "$0" "$@"
    fi
fi

set -e

VERSION="2.0.0"
PORT="8088"

# ── 1. Target Directory Detection & Fallback ────────────────────────────────
# NetHunter & standard Linux use /opt/usb_hid_deck.
# Standalone Android (system-as-root read-only /) falls back to /data/local/usb_hid_deck.
if [ -w /opt ] || mkdir -p /opt/usb_hid_deck 2>/dev/null; then
    INSTALL_DIR="/opt/usb_hid_deck"
elif [ -n "$PREFIX" ] && [ -d "$PREFIX" ]; then
    INSTALL_DIR="$PREFIX/opt/usb_hid_deck"
    mkdir -p "${INSTALL_DIR}" || true
else
    INSTALL_DIR="/data/local/usb_hid_deck"
    mkdir -p "${INSTALL_DIR}" || true
fi

echo "[*] Installing Emittr v${VERSION} to ${INSTALL_DIR}..."

# Copy files if executing outside target directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "${SCRIPT_DIR}" != "${INSTALL_DIR}" ]; then
    mkdir -p "${INSTALL_DIR}"
    cp -r "${SCRIPT_DIR}"/* "${INSTALL_DIR}/" || { echo "[-] File copy failed. Please run as root."; exit 1; }
fi

# Ensure executable permissions on all binaries and scripts
chmod +x "${INSTALL_DIR}/server.py" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/setup_gadget.py" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/02-usb-deck.sh" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/usbtype" 2>/dev/null || true
chmod +x "${INSTALL_DIR}/emittr" 2>/dev/null || true

# ── 2. Python Environment & Dependency Auto-Installer ────────────────────────
echo "[*] Checking Python runtime & dependencies..."
find_py() {
    if [ -x "/opt/tactical_venv/bin/python3" ]; then
        echo "/opt/tactical_venv/bin/python3"
    elif [ -x "/usr/bin/python3" ]; then
        echo "/usr/bin/python3"
    elif command -v python3 >/dev/null 2>&1; then
        command -v python3
    elif [ -n "$PREFIX" ] && [ -x "$PREFIX/bin/python3" ]; then
        echo "$PREFIX/bin/python3"
    else
        echo "python3"
    fi
}
PY_BIN="$(find_py)"

# If Python3 is completely missing, attempt package manager install
if ! command -v "$PY_BIN" >/dev/null 2>&1 && [ ! -x "$PY_BIN" ]; then
    echo "[*] Python 3 not found. Installing via system package manager..."
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq 2>/dev/null || true
        apt-get install -y -qq python3 python3-pip iptables curl 2>/dev/null || true
    elif command -v pkg >/dev/null 2>&1; then
        pkg install -y python python-pip iptables curl 2>/dev/null || true
    fi
    PY_BIN="$(find_py)"
fi

# Check for essential Python modules (FastAPI, Uvicorn, WebSockets)
if ! "$PY_BIN" -c "import fastapi, uvicorn, websockets" >/dev/null 2>&1; then
    echo "[*] Required Python packages (FastAPI, Uvicorn, WebSockets) missing. Installing..."
    
    # 1. Try apt-get system packages first (cleanest on Debian/Kali Bookworm)
    if command -v apt-get >/dev/null 2>&1; then
        apt-get update -qq 2>/dev/null || true
        apt-get install -y -qq python3-fastapi python3-uvicorn python3-websockets 2>/dev/null || true
    fi

    # 2. Fallback to pip (handles PEP 668 externally-managed environments via --break-system-packages)
    if ! "$PY_BIN" -c "import fastapi, uvicorn, websockets" >/dev/null 2>&1; then
        echo "[*] Installing via pip..."
        "$PY_BIN" -m pip install --break-system-packages -q -r "${INSTALL_DIR}/requirements.txt" 2>/dev/null || \
        "$PY_BIN" -m pip install -q -r "${INSTALL_DIR}/requirements.txt" 2>/dev/null || \
        pip3 install --break-system-packages -q -r "${INSTALL_DIR}/requirements.txt" 2>/dev/null || \
        pip3 install -q -r "${INSTALL_DIR}/requirements.txt" 2>/dev/null || true
    fi
fi

if "$PY_BIN" -c "import fastapi, uvicorn, websockets" >/dev/null 2>&1; then
    echo "[+] Python dependencies verified successfully."
else
    echo "[-] Warning: Some Python packages could not be installed automatically."
    echo "    Please run: pip3 install -r ${INSTALL_DIR}/requirements.txt"
fi

# ── 3. Global Binary Symlinks (PATH integration) ────────────────────────────
for bin_dir in /usr/local/bin /usr/bin; do
    if [ -d "$bin_dir" ] && [ -w "$bin_dir" ]; then
        ln -sf "${INSTALL_DIR}/emittr" "${bin_dir}/emittr" 2>/dev/null || true
        ln -sf "${INSTALL_DIR}/usbtype" "${bin_dir}/usbtype" 2>/dev/null || true
    fi
done

# Termux integration
if [ -d "/data/data/com.termux/files/usr/bin" ]; then
    ln -sf "${INSTALL_DIR}/emittr" /data/data/com.termux/files/usr/bin/emittr 2>/dev/null || true
    ln -sf "${INSTALL_DIR}/usbtype" /data/data/com.termux/files/usr/bin/usbtype 2>/dev/null || true
fi

# Expose wrapper to Android host /system/bin if writable
if [ -w /proc/1/root/system/bin ]; then
    cat << EOF > /proc/1/root/system/bin/emittr
#!/system/bin/sh
if [ -f /data/local/nhsystem/bin/bootkali ]; then
    exec /data/local/nhsystem/bin/bootkali ${INSTALL_DIR}/emittr "\$@"
else
    exec ${INSTALL_DIR}/emittr "\$@"
fi
EOF
    chmod +x /proc/1/root/system/bin/emittr 2>/dev/null || true
fi

# ── 4. Android USB & SELinux Guards ─────────────────────────────────────────
# Suppress Android framework from forcing MTP / mass_storage
/system/bin/setprop persist.sys.usb.config none 2>/dev/null || true
/system/bin/setprop sys.usb.config none 2>/dev/null || true

# Apply SELinux policies so untrusted apps & chroot can access /dev/hidg*
if command -v supolicy >/dev/null 2>&1; then
    supolicy --live "allow untrusted_app hid_device chr_file { read write open ioctl }" 2>/dev/null || true
    supolicy --live "allow system_app hid_device chr_file { read write open ioctl }" 2>/dev/null || true
elif command -v magiskpolicy >/dev/null 2>&1; then
    magiskpolicy --live "allow * hid_device chr_file *" 2>/dev/null || true
fi
chcon u:object_r:hid_device:s0 /dev/hidg* 2>/dev/null || true

# ── 5. Systemless Hosts File Configuration (emittr/ URL) ────────────────────
# Add emittr hostname to chroot /etc/hosts
for HOST_NAME in "emittr" "emittr.local" "hid.keyboard"; do
    if ! grep -qw "${HOST_NAME}" /etc/hosts 2>/dev/null; then
        echo "127.0.0.1 ${HOST_NAME}" >> /etc/hosts 2>/dev/null || true
        echo "[+] Added ${HOST_NAME} to /etc/hosts"
    fi
done

# Bind-mount Android system hosts so phone browsers (Chrome, Firefox) resolve 'emittr/'
ANDROID_HOSTS=""
if [ -f /proc/1/root/system/etc/hosts ]; then
    ANDROID_HOSTS="/proc/1/root/system/etc/hosts"
elif [ -f /system/etc/hosts ]; then
    ANDROID_HOSTS="/system/etc/hosts"
fi

if [ -n "$ANDROID_HOSTS" ]; then
    if ! grep -qw "emittr" "$ANDROID_HOSTS" 2>/dev/null; then
        mkdir -p /data/local/tmp 2>/dev/null || true
        cp "$ANDROID_HOSTS" /data/local/tmp/hosts 2>/dev/null || true
        echo "127.0.0.1 emittr emittr.local hid.keyboard" >> /data/local/tmp/hosts 2>/dev/null || true
        mount -o bind /data/local/tmp/hosts "$ANDROID_HOSTS" 2>/dev/null || \
        echo "127.0.0.1 emittr emittr.local hid.keyboard" >> "$ANDROID_HOSTS" 2>/dev/null || true
        echo "[+] Configured Android hosts resolution for 'emittr/'"
    fi
fi

# ── 6. Idempotent Port 80 -> 8088 Loopback Redirection ───────────────────────
if command -v iptables >/dev/null 2>&1; then
    iptables -t nat -C PREROUTING -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port ${PORT} 2>/dev/null || \
    iptables -t nat -A PREROUTING -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port ${PORT} 2>/dev/null || true

    iptables -t nat -C OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-port ${PORT} 2>/dev/null || \
    iptables -t nat -A OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-port ${PORT} 2>/dev/null || true
fi

# ── 7. Magisk / KernelSU Boot Autostart Persistence ─────────────────────────
if [ -d "/data/adb/service.d" ]; then
    cp "${INSTALL_DIR}/02-usb-deck.sh" /data/adb/service.d/02-usb-deck.sh 2>/dev/null || true
    chmod +x /data/adb/service.d/02-usb-deck.sh 2>/dev/null || true
    echo "[+] Registered boot autostart in /data/adb/service.d/02-usb-deck.sh"
fi

# ── 8. Launch Service ────────────────────────────────────────────────────────
# Stop any stale instances
pkill -f "server.py" 2>/dev/null || true
sleep 0.8

echo "[*] Launching Emittr daemon via CLI..."
"${INSTALL_DIR}/emittr" start

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  [+] Emittr v${VERSION} installed successfully!"
echo "      • emittr start     - Start daemon & port 80 redirect"
echo "      • emittr stop      - Stop daemon & release stuck keys"
echo "      • emittr status    - Show service & active IP addresses"
echo "      • emittr ip        - Print all device IPs & URLs"
echo "      • emittr logs      - Stream or view logs"
echo "      • usbtype          - Inject scancodes/text directly via CLI"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
