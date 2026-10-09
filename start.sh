#!/bin/bash
pkill -f "usb_hid_deck/server.py" 2>/dev/null || true
sleep 1
if [ -x "/opt/tactical_venv/bin/python3" ]; then
    PY="/opt/tactical_venv/bin/python3"
else
    PY="python3"
fi
CERT_DIR="/opt/usb_hid_deck/certs"
if [ -f "${CERT_DIR}/emittr.crt" ] && [ -f "${CERT_DIR}/emittr.key" ]; then
    export EMITTR_SSL_CERT="${CERT_DIR}/emittr.crt"
    export EMITTR_SSL_KEY="${CERT_DIR}/emittr.key"
fi
nohup "$PY" /opt/usb_hid_deck/server.py > /var/log/usb_deck.log 2>&1 &
echo "Started USB Typer server."
