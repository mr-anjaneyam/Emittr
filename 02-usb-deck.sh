#!/system/bin/sh
# Autostart daemon for USB Typer & HID Deck
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 2
done

# Ensure HID node permissions
chmod 666 /dev/hidg* 2>/dev/null || true

# Setup hid.keyboard in /system/etc/hosts via safe bind mount
if ! grep -q "hid.keyboard" /system/etc/hosts 2>/dev/null; then
    cp /system/etc/hosts /data/local/tmp/hosts
    echo "127.0.0.1 hid.keyboard" >> /data/local/tmp/hosts
    mount -o bind /data/local/tmp/hosts /system/etc/hosts 2>/dev/null || true
fi

# Launch USB Typer in Kali NetHunter chroot
if [ -f /data/local/nhsystem/bin/bootkali ]; then
    /data/local/nhsystem/bin/bootkali bash -c "mkdir -p /config && mount -t configfs none /config 2>/dev/null; if [ -x /opt/tactical_venv/bin/python3 ]; then PY=/opt/tactical_venv/bin/python3; else PY=python3; fi; \$PY /opt/usb_hid_deck/setup_gadget.py 2>/dev/null; nohup \$PY /opt/usb_hid_deck/server.py > /var/log/usb_deck.log 2>&1 &" 2>/dev/null || true
fi
hello World 12
