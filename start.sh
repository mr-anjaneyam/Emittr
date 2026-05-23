#!/bin/bash
pkill -f "usb_hid_deck/server.py" 2>/dev/null || true
sleep 1
if [ -x "/opt/tactical_venv/bin/python3" ]; then
    PY="/opt/tactical_venv/bin/python3"
else
    PY="python3"
fi
nohup "$PY" /opt/usb_hid_deck/server.py > /var/log/usb_deck.log 2>&1 &
echo "Started USB Typer server."
