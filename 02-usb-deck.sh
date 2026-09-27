#!/system/bin/sh
# Autostart daemon for Emittr USB HID Deck (v1.3.0)
BOOT_LOG="/data/local/tmp/emittr_boot.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 02-usb-deck.sh starting" >> "${BOOT_LOG}" 2>/dev/null

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 2
done

# HID mode is opt-in (Settings toggle inside the app), so USB function suppression
# only happens via setup_gadget.py when actually enabling HID — not unconditionally
# at every boot. This lets NetHunter's own USB-function choice stand by default.

# Setup hid.keyboard in /system/etc/hosts via safe bind mount
if ! grep -q "hid.keyboard" /system/etc/hosts 2>/dev/null; then
    cp /system/etc/hosts /data/local/tmp/hosts
    echo "127.0.0.1 hid.keyboard" >> /data/local/tmp/hosts
    if mount -o bind /data/local/tmp/hosts /system/etc/hosts 2>>"${BOOT_LOG}"; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] hosts bind-mount OK" >> "${BOOT_LOG}" 2>/dev/null
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] hosts bind-mount FAILED (non-fatal)" >> "${BOOT_LOG}" 2>/dev/null
    fi
fi

# Launch Emittr server in Kali NetHunter chroot
if [ -f /data/local/nhsystem/bin/bootkali ]; then
    /data/local/nhsystem/bin/bootkali bash -c "mkdir -p /config && mount -t configfs none /config 2>/dev/null; if [ -x /opt/tactical_venv/bin/python3 ]; then PY=/opt/tactical_venv/bin/python3; else PY=python3; fi; if [ -f /opt/usb_hid_deck/.emittr_hid_mode ] && [ \"\$(cat /opt/usb_hid_deck/.emittr_hid_mode)\" = \"1\" ]; then \"\${PY}\" /opt/usb_hid_deck/setup_gadget.py 2>/dev/null; chmod 660 /dev/hidg* 2>/dev/null; fi; nohup \"\${PY}\" /opt/usb_hid_deck/server.py > /dev/null 2>> /var/log/usb_deck.crash.log &" >> "${BOOT_LOG}" 2>&1 || echo "[$(date '+%Y-%m-%d %H:%M:%S')] bootkali launch FAILED (non-fatal)" >> "${BOOT_LOG}" 2>/dev/null
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] bootkali launch attempted" >> "${BOOT_LOG}" 2>/dev/null
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] bootkali binary not found, skipping server launch" >> "${BOOT_LOG}" 2>/dev/null
fi

