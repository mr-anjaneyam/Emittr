#!/usr/bin/env bash
# ==============================================================================
# build-deb.sh - Build standalone .deb package for Emittr v2.0.0
# ==============================================================================
set -e

PKG_NAME="emittr"
VERSION="${1:-2.0.0}"
if [ -z "$1" ] && [ -f debian/changelog ]; then
    CHANGELOG_VER=$(head -n 1 debian/changelog 2>/dev/null | sed -n 's/.*(\(.*\)).*/\1/p' | cut -d'-' -f1)
    if [ -n "$CHANGELOG_VER" ]; then
        VERSION="$CHANGELOG_VER"
    fi
fi
DEB_FILE="${PKG_NAME}_${VERSION}_all.deb"
BUILD_DIR="$(mktemp -d -t emittr-deb-XXXXXX)"

echo "[*] Packaging Emittr v${VERSION} into ${DEB_FILE}..."

# Setup package hierarchy
mkdir -p "${BUILD_DIR}/DEBIAN"
mkdir -p "${BUILD_DIR}/opt/usb_hid_deck"
mkdir -p "${BUILD_DIR}/usr/bin"
mkdir -p "${BUILD_DIR}/lib/systemd/system"
mkdir -p "${BUILD_DIR}/usr/share/doc/emittr"

# 1. Copy Debian maintainer scripts
cp debian/postinst "${BUILD_DIR}/DEBIAN/"
cp debian/prerm "${BUILD_DIR}/DEBIAN/"
cp debian/postrm "${BUILD_DIR}/DEBIAN/"
chmod 755 "${BUILD_DIR}/DEBIAN/postinst"
chmod 755 "${BUILD_DIR}/DEBIAN/prerm"
chmod 755 "${BUILD_DIR}/DEBIAN/postrm"

# 2. Copy Application Payload into /opt/usb_hid_deck
cp server.py "${BUILD_DIR}/opt/usb_hid_deck/"
cp setup_gadget.py "${BUILD_DIR}/opt/usb_hid_deck/"
cp emittr "${BUILD_DIR}/opt/usb_hid_deck/"
cp usbtype "${BUILD_DIR}/opt/usb_hid_deck/"
cp 02-usb-deck.sh "${BUILD_DIR}/opt/usb_hid_deck/"
cp requirements.txt "${BUILD_DIR}/opt/usb_hid_deck/"
cp -r static "${BUILD_DIR}/opt/usb_hid_deck/"

chmod 755 "${BUILD_DIR}/opt/usb_hid_deck/server.py"
chmod 755 "${BUILD_DIR}/opt/usb_hid_deck/setup_gadget.py"
chmod 755 "${BUILD_DIR}/opt/usb_hid_deck/emittr"
chmod 755 "${BUILD_DIR}/opt/usb_hid_deck/usbtype"
chmod 755 "${BUILD_DIR}/opt/usb_hid_deck/02-usb-deck.sh"

# 3. Create global symlinks in /usr/bin
ln -sf /opt/usb_hid_deck/emittr "${BUILD_DIR}/usr/bin/emittr"
ln -sf /opt/usb_hid_deck/usbtype "${BUILD_DIR}/usr/bin/usbtype"

# 4. Copy systemd service
cp debian/emittr.service "${BUILD_DIR}/lib/systemd/system/"

# 5. Copy documentation & license
cp LICENSE "${BUILD_DIR}/usr/share/doc/emittr/copyright"
if [ -f debian/changelog ]; then
    cp debian/changelog "${BUILD_DIR}/usr/share/doc/emittr/changelog.Debian"
    gzip -9 -n -f "${BUILD_DIR}/usr/share/doc/emittr/changelog.Debian" 2>/dev/null || true
fi

# 6. Calculate Installed-Size and generate binary DEBIAN/control
# (Note: debian/control is a source control file; dpkg-deb requires a single-stanza binary control file)
INSTALLED_SIZE=$(du -sk "${BUILD_DIR}" | cut -f1)

cat <<EOF > "${BUILD_DIR}/DEBIAN/control"
Package: ${PKG_NAME}
Version: ${VERSION}
Architecture: all
Maintainer: Anjaneyam <mr.anjaneyam@gmail.com>
Installed-Size: ${INSTALLED_SIZE}
Section: utils
Priority: optional
Homepage: https://github.com/mr-anjaneyam/Emittr
Depends: python3 (>= 3.7), python3-pip, python3-fastapi | python3-pip, python3-uvicorn | python3-pip, python3-websockets | python3-pip, iptables, curl | wget
Recommends: magisk | kali-nethunter
Description: Tactical USB HID Deck and Local Network Air-Gap Relay
 Emittr turns any rooted Android or NetHunter phone into a hardware-grade
 USB composite keyboard, precision trackpad, and continuous scrolling deck.
 .
 Features:
  - Zero host drivers: speaks native USB Boot Protocol (works in BIOS/UEFI)
  - 1,000 WPM bulk text and script injection
  - Dual virtual Xbox thumbsticks with native hardware AC Pan horizontal scroll
  - Local Network Relay: stream credentials from mobile vaults over local Wi-Fi
  - Accessible locally at http://emittr/ on port 80
  - Global CLI management via 'emittr start', 'stop', and 'status'
EOF

# 7. Build .deb binary package
dpkg-deb --build --root-owner-group "${BUILD_DIR}" "${DEB_FILE}"

# Cleanup staging
rm -rf "${BUILD_DIR}"

echo "[+] Successfully built: ${DEB_FILE} ($(du -h "${DEB_FILE}" | cut -f1))"
echo "    Install with: sudo apt install ./${DEB_FILE}"
