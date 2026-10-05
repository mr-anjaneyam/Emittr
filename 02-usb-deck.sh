#!/system/bin/sh
# Autostart daemon for Emittr USB HID Deck (v1.3.0)
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 2
done

# Suppress Android framework from forcing mass_storage
setprop persist.sys.usb.config none 2>/dev/null || true
setprop sys.usb.config none 2>/dev/null || true

# Ensure HID node permissions
chmod 666 /dev/hidg* 2>/dev/null || true

# Setup emittr in /system/etc/hosts via safe bind mount (so 'emittr/' resolves in Chrome)
if ! grep -qw "emittr" /system/etc/hosts 2>/dev/null; then
    umount /system/etc/hosts 2>/dev/null || true
    cp /system/etc/hosts /data/local/tmp/hosts
    echo "127.0.0.1 emittr emittr.local hid.keyboard" >> /data/local/tmp/hosts
    mount -o bind /data/local/tmp/hosts /system/etc/hosts 2>/dev/null || true
fi

# Setup iptables loopback port 80 -> 8088 redirection
iptables -t nat -A PREROUTING -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port 8088 2>/dev/null || true
iptables -t nat -A OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-port 8088 2>/dev/null || true

# Launch Emittr server in Kali NetHunter chroot
if [ -f /data/local/nhsystem/bin/bootkali ]; then
    /data/local/nhsystem/bin/bootkali /opt/usb_hid_deck/emittr start >/dev/null 2>&1 || \
    /data/local/nhsystem/bin/bootkali bash -c "mkdir -p /config && mount -t configfs none /config 2>/dev/null; if [ -x /opt/tactical_venv/bin/python3 ]; then PY=/opt/tactical_venv/bin/python3; else PY=python3; fi; \"${PY}\" /opt/usb_hid_deck/setup_gadget.py 2>/dev/null; nohup \"${PY}\" /opt/usb_hid_deck/server.py > /var/log/usb_deck.log 2>&1 &" 2>/dev/null || true
fi
