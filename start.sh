#!/bin/bash
pkill -f "usb_hid_deck/server.py" 2>/dev/null || true
sleep 1
if [ -x "/opt/tactical_venv/bin/python3" ]; then
    PY="/opt/tactical_venv/bin/python3"
else
    PY="python3"
fi
# server.py manages its own rotating log file at /var/log/usb_deck.log, so stdout
# is discarded here to avoid a second, non-rotating writer targeting the same path.
# Startup crashes that occur before logging is configured land in the crash log instead.
nohup "$PY" /opt/usb_hid_deck/server.py > /dev/null 2>> /var/log/usb_deck.crash.log &
echo "Started USB Typer server."
