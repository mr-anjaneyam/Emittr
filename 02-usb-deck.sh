#!/system/bin/sh
# Autostart daemon for Emittr USB HID Deck (v1.3.0)
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 2
done

# Suppress Android framework from forcing mass_storage
setprop persist.sys.usb.config none 2>/dev/null || true
setprop sys.usb.config none 2>/dev/null || true

# Ensure HID node permissions & SELinux context
chmod 666 /dev/hidg* 2>/dev/null || true
if command -v supolicy >/dev/null 2>&1; then
    supolicy --live "allow untrusted_app hid_device chr_file { read write open ioctl }" 2>/dev/null || true
elif command -v magiskpolicy >/dev/null 2>&1; then
    magiskpolicy --live "allow * hid_device chr_file *" 2>/dev/null || true
fi
chcon u:object_r:hid_device:s0 /dev/hidg* 2>/dev/null || true

# Setup emittr in /system/etc/hosts via safe bind mount (so 'emittr/' resolves in Chrome)
if ! grep -qw "emittr" /system/etc/hosts 2>/dev/null; then
    umount /system/etc/hosts 2>/dev/null || true
    cp /system/etc/hosts /data/local/tmp/hosts 2>/dev/null || true
    echo "127.0.0.1 emittr emittr.local hid.keyboard" >> /data/local/tmp/hosts
    mount -o bind /data/local/tmp/hosts /system/etc/hosts 2>/dev/null || true
fi

# Setup iptables loopback port 80 -> 8088 redirection (idempotent)
if command -v iptables >/dev/null 2>&1; then
    iptables -t nat -C PREROUTING -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port 8088 2>/dev/null || \
    iptables -t nat -A PREROUTING -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port 8088 2>/dev/null || true

    iptables -t nat -C OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-port 8088 2>/dev/null || \
    iptables -t nat -A OUTPUT -p tcp -o lo --dport 80 -j REDIRECT --to-port 8088 2>/dev/null || true
fi

# Launch Emittr service across NetHunter chroot or standalone root environment
if [ -f /data/local/nhsystem/bin/bootkali ]; then
    /data/local/nhsystem/bin/bootkali /opt/usb_hid_deck/emittr start >/dev/null 2>&1 || true
elif [ -x /opt/usb_hid_deck/emittr ]; then
    /opt/usb_hid_deck/emittr start >/dev/null 2>&1 || true
elif [ -x /data/local/usb_hid_deck/emittr ]; then
    /data/local/usb_hid_deck/emittr start >/dev/null 2>&1 || true
fi
