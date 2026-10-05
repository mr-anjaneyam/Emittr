#!/usr/bin/env bash
# ==============================================================================
# build-deb.sh - Build standalone .deb package for Emittr v1.3.0
# ==============================================================================
set -e

VERSION="1.3.0"
PKG_NAME="emittr"
DEB_FILE="${PKG_NAME}_${VERSION}_all.deb"
BUILD_DIR="$(mktemp -d -t emittr-deb-XXXXXX)"

echo "[*] Packaging Emittr v${VERSION} into ${DEB_FILE}..."

# Setup package hierarchy
mkdir -p "${BUILD_DIR}/DEBIAN"
mkdir -p "${BUILD_DIR}/opt/usb_hid_deck"
mkdir -p "${BUILD_DIR}/usr/bin"
mkdir -p "${BUILD_DIR}/lib/systemd/system"
mkdir -p "${BUILD_DIR}/usr/share/doc/emittr"

# 1. Copy Debian control files
cp debian/control "${BUILD_DIR}/DEBIAN/"
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
cp debian/changelog "${BUILD_DIR}/usr/share/doc/emittr/changelog.Debian"
gzip -9 -n "${BUILD_DIR}/usr/share/doc/emittr/changelog.Debian"

# 6. Calculate Installed-Size and update control
INSTALLED_SIZE=$(du -sk "${BUILD_DIR}" | cut -f1)
echo "Installed-Size: ${INSTALLED_SIZE}" >> "${BUILD_DIR}/DEBIAN/control"

# 7. Build .deb binary package
dpkg-deb --build --root-owner-group "${BUILD_DIR}" "${DEB_FILE}"

# Cleanup staging
rm -rf "${BUILD_DIR}"

echo "[+] Successfully built: ${DEB_FILE} ($(du -h "${DEB_FILE}" | cut -f1))"
echo "    Install with: sudo apt install ./${DEB_FILE}"
