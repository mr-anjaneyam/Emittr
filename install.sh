#!/bin/bash
# ==============================================================================
# Emittr — Tactical USB HID Controller Installer  v1.3.0
# "Your phone. Their keyboard. Shh."
#
# Works on any rooted Android + NetHunter (or plain Linux) chroot with configfs
# gadget support. No device-specific paths are hardcoded — everything that can
# vary between phones (Python location, UDC name, IP, install dir, port) is
# auto-detected or overridable via environment variables.
# ==============================================================================

VERSION="1.3.0"
INSTALL_DIR="${EMITTR_INSTALL_DIR:-/opt/usb_hid_deck}"
PORT="${EMITTR_PORT:-8088}"

# ── Colors (disabled automatically when not attached to a terminal) ────────
if [ -t 1 ]; then
    C_RESET='\033[0m'; C_BOLD='\033[1m'
    C_RED='\033[31m'; C_GREEN='\033[32m'; C_YELLOW='\033[33m'
    C_CYAN='\033[36m'; C_MAGENTA='\033[35m'
else
    C_RESET=''; C_BOLD=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_CYAN=''; C_MAGENTA=''
fi

log()  { echo -e "${C_CYAN}[*]${C_RESET} $*"; }
ok()   { echo -e "${C_GREEN}[+]${C_RESET} $*"; }
warn() { echo -e "${C_YELLOW}[!]${C_RESET} $*"; }
info() { echo -e "${C_MAGENTA}[i]${C_RESET} $*"; }
fail() { echo -e "${C_RED}[-]${C_RESET} $*"; exit 1; }

print_banner() {
    echo -e "${C_CYAN}${C_BOLD}"
    cat <<'BANNER'
  _____           _  _   _
 |  ___|_ __ ___ (_)| |_| |_ _ __
 | |_  | '_ ` _ \| || __| __| '__|
 |  _| | | | | | | || |_| |_| |
 |_|   |_| |_| |_|_| \__|\__|_|
BANNER
    echo -e "${C_RESET}${C_MAGENTA}  Your phone. Their keyboard. Shh.${C_RESET}"
    echo -e "${C_YELLOW}  Emittr v${VERSION} — Tactical USB HID Deployment${C_RESET}"
    echo
}

require_root() {
    if [ "$(id -u)" != "0" ]; then
        fail "Root privileges required — sudo it, su it, or don't do it."
    fi
}

# ── Environment detection (kept generic so this runs on any phone) ─────────
detect_python() {
    if [ -n "${EMITTR_PYTHON:-}" ] && [ -x "${EMITTR_PYTHON}" ]; then
        echo "${EMITTR_PYTHON}"; return
    fi
    for candidate in /opt/tactical_venv/bin/python3 /usr/bin/python3 /usr/local/bin/python3; do
        if [ -x "${candidate}" ]; then
            echo "${candidate}"; return
        fi
    done
    command -v python3 2>/dev/null || true
}

PY_BIN=""

is_running() {
    pgrep -f "${INSTALL_DIR}/server.py" >/dev/null 2>&1
}

stop_server() {
    if is_running; then
        log "Evicting the previous Emittr instance..."
        pkill -f "${INSTALL_DIR}/server.py" 2>/dev/null || true
        for _ in 1 2 3 4 5; do
            is_running || break
            sleep 1
        done
        is_running && pkill -9 -f "${INSTALL_DIR}/server.py" 2>/dev/null || true
        ok "Previous instance stopped."
    else
        info "No running instance found — clean slate."
    fi
}

start_server() {
    local cert_dir="${INSTALL_DIR}/certs"
    if [ -f "${cert_dir}/emittr.crt" ] && [ -f "${cert_dir}/emittr.key" ]; then
        export EMITTR_SSL_CERT="${cert_dir}/emittr.crt"
        export EMITTR_SSL_KEY="${cert_dir}/emittr.key"
    fi
    log "Starting Emittr on port ${PORT} using ${PY_BIN}..."
    # server.py owns its own rotating log file (/var/log/usb_deck.log); stdout is
    # discarded here to avoid a second, non-rotating writer targeting the same path.
    nohup "${PY_BIN}" "${INSTALL_DIR}/server.py" > /dev/null 2>> /var/log/usb_deck.crash.log &
}

wait_healthy() {
    local scheme="http"
    [ -f "${INSTALL_DIR}/certs/emittr.crt" ] && scheme="https"
    # Poll instead of a fixed sleep so slow-booting devices aren't falsely
    # reported as failed, while fast devices don't wait unnecessarily.
    for _ in $(seq 1 15); do
        sleep 1
        if curl -sk "${scheme}://127.0.0.1:${PORT}/api/status" 2>/dev/null | grep -q '"version"'; then
            return 0
        fi
    done
    return 1
}

setup_hosts() {
    if ! grep -q "hid.keyboard" /etc/hosts 2>/dev/null; then
        echo "127.0.0.1 hid.keyboard" >> /etc/hosts
        ok "Added hid.keyboard to chroot /etc/hosts"
    fi
    # Best-effort: also add to the Android system hosts if reachable from this chroot.
    if [ -f /proc/1/root/system/etc/hosts ]; then
        if ! grep -q "hid.keyboard" /proc/1/root/system/etc/hosts 2>/dev/null; then
            echo "127.0.0.1 hid.keyboard" >> /proc/1/root/system/etc/hosts 2>/dev/null || true
        fi
    fi
}

maybe_init_gadget() {
    # HID mode is opt-in: only claim the USB gadget/UDC if the user has explicitly
    # enabled it from Settings (mirrors NetHunter's own USB-function switch instead
    # of overriding it on every install/boot).
    local hid_flag="${INSTALL_DIR}/.emittr_hid_mode"
    if [ -f "${hid_flag}" ] && [ "$(cat "${hid_flag}" 2>/dev/null)" = "1" ]; then
        /system/bin/setprop persist.sys.usb.config none 2>/dev/null || true
        /system/bin/setprop sys.usb.config none 2>/dev/null || true
        "${PY_BIN}" "${INSTALL_DIR}/setup_gadget.py" || true
        chmod 660 /dev/hidg* 2>/dev/null || true
    else
        info "HID mode is opt-in and currently off — enable it from Settings when you're ready."
    fi
}

do_install() {
    log "Deploying Emittr to ${INSTALL_DIR}..."
    mkdir -p "${INSTALL_DIR}" || fail "Cannot create ${INSTALL_DIR}. Run as root."
    stop_server

    if [ "$(cd "$(dirname "$0")" && pwd)" != "${INSTALL_DIR}" ]; then
        cp -r ./* "${INSTALL_DIR}/" || fail "File copy failed."
    fi

    chmod +x "${INSTALL_DIR}"/server.py "${INSTALL_DIR}"/setup_gadget.py \
             "${INSTALL_DIR}"/02-usb-deck.sh "${INSTALL_DIR}"/usbtype \
             "${INSTALL_DIR}"/start.sh 2>/dev/null || true

    ln -sf "${INSTALL_DIR}/usbtype" /usr/local/bin/usbtype

    maybe_init_gadget
    setup_hosts
    start_server

    if wait_healthy; then
        ok "Emittr v${VERSION} is ONLINE and HEALTHY!"
        local scheme="http"
        [ -f "${INSTALL_DIR}/certs/emittr.crt" ] && scheme="https"
        echo "    Local URL:   ${scheme}://localhost:${PORT} or ${scheme}://hid.keyboard"
        echo "    Network URL: ${scheme}://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
        echo "    CLI Tool:    usbtype --help"
    else
        warn "Server did not respond healthy within 15s. Check /var/log/usb_deck.log"
    fi
}

enable_https() {
    local cert_dir="${INSTALL_DIR}/certs"
    mkdir -p "${cert_dir}"

    if [ -f "${cert_dir}/emittr.crt" ] && [ -f "${cert_dir}/emittr.key" ]; then
        warn "A certificate already exists at ${cert_dir}."
        read -r -p "  Regenerate it? [y/N] " ans
        case "${ans}" in
            y|Y) ;;
            *) info "Keeping the existing certificate."; return ;;
        esac
    fi

    if ! command -v openssl >/dev/null 2>&1; then
        fail "openssl not found; cannot generate a certificate."
    fi

    local ip
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [ -z "${ip}" ] && ip="127.0.0.1"

    log "Generating a self-signed certificate for ${ip}..."
    openssl req -x509 -newkey rsa:2048 -nodes \
        -keyout "${cert_dir}/emittr.key" -out "${cert_dir}/emittr.crt" \
        -days 3650 -subj "/CN=${ip}" \
        -addext "subjectAltName=IP:${ip},IP:127.0.0.1,DNS:hid.keyboard,DNS:localhost" \
        >/dev/null 2>&1 || fail "Certificate generation failed."
    chmod 600 "${cert_dir}/emittr.key"
    chmod 644 "${cert_dir}/emittr.crt"
    ok "Certificate ready. Browsers will flag it as self-signed until you trust it manually."

    read -r -p "  Restart Emittr now to serve over HTTPS/WSS? [Y/n] " ans
    case "${ans}" in
        n|N) info "Certificate saved. It takes effect next time Emittr restarts." ;;
        *) stop_server; start_server; wait_healthy && ok "Emittr is back up over HTTPS." || warn "Didn't come back healthy in time; check /var/log/usb_deck.log" ;;
    esac
}

regen_token() {
    local token_file="${INSTALL_DIR}/.emittr_token"
    warn "Regenerating the auth token invalidates every browser session currently connected."
    read -r -p "  Continue? [y/N] " ans
    case "${ans}" in
        y|Y) ;;
        *) info "Cancelled."; return ;;
    esac
    rm -f "${token_file}"
    stop_server
    start_server
    wait_healthy && ok "New token generated and service restarted." || warn "Didn't come back healthy in time; check /var/log/usb_deck.log"
}

uninstall() {
    warn "This stops Emittr and removes the 'usbtype' CLI symlink."
    read -r -p "  Also erase the auth token, HID-mode flag, and TLS cert (wipe ${INSTALL_DIR})? [y/N] " purge
    stop_server
    rm -f /usr/local/bin/usbtype
    case "${purge}" in
        y|Y) rm -rf "${INSTALL_DIR}"; ok "Emittr and all its data have been wiped. No hard feelings." ;;
        *) ok "Emittr stopped. Files kept at ${INSTALL_DIR} in case you change your mind." ;;
    esac
}

status() {
    local scheme="http"
    [ -f "${INSTALL_DIR}/certs/emittr.crt" ] && scheme="https"
    if is_running; then
        ok "Emittr is running (pid $(pgrep -f "${INSTALL_DIR}/server.py" | head -1)) over ${scheme}."
        curl -sk "${scheme}://127.0.0.1:${PORT}/api/status" 2>/dev/null && echo
    else
        warn "Emittr is not running."
    fi
}

show_menu() {
    echo -e "${C_CYAN}  ------------------------------------------------${C_RESET}"
    echo "   [1] Install / Update      - deploy or refresh in place"
    echo "   [2] Enable HTTPS          - self-signed cert for wss://"
    echo "   [3] Restart service       - kill it with kindness, relaunch"
    echo "   [4] Status check          - is anyone home?"
    echo "   [5] Regenerate auth token - rotate the keys to the kingdom"
    echo "   [6] Uninstall             - erase all evidence"
    echo "   [7] Exit                  - leave no trace"
    echo -e "${C_CYAN}  ------------------------------------------------${C_RESET}"
}

main_menu() {
    while true; do
        print_banner
        show_menu
        read -r -p "  Choose an option [1-7]: " choice
        echo
        case "${choice}" in
            1) do_install ;;
            2) enable_https ;;
            3) stop_server; start_server; wait_healthy && ok "Restarted." || warn "Didn't come back healthy in time." ;;
            4) status ;;
            5) regen_token ;;
            6) uninstall; break ;;
            7|q|Q) echo "  Stay tactical."; break ;;
            *) warn "Not a valid option." ;;
        esac
        echo
        read -r -p "  Press Enter to continue..." _
        echo
    done
}

# ── Entry point ──────────────────────────────────────────────────────────────
require_root
PY_BIN="$(detect_python)"
[ -z "${PY_BIN}" ] && fail "No usable python3 found. Install Python 3 and retry."

if [ -t 0 ] && [ -t 1 ] && [ -z "${1:-}" ]; then
    main_menu
else
    case "${1:-install}" in
        install)   do_install ;;
        https)     enable_https ;;
        restart)   stop_server; start_server; wait_healthy && ok "Restarted." || warn "Didn't come back healthy in time." ;;
        status)    status ;;
        token)     regen_token ;;
        uninstall) uninstall ;;
        *)         do_install ;;
    esac
fi

