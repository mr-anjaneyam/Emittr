# Emittr - Debian & APT Packaging Guide

This guide explains how Emittr is packaged as a `.deb` package and how to submit it to official repositories (Kali NetHunter, Termux, and Debian/Ubuntu) so users can install it via:
```bash
apt install emittr
```

---

## 📦 1. Direct `.deb` Package Build & Install

Emittr includes ready-to-use Debian package metadata in the [`debian/`](debian/) directory and an autonomous builder script [`build-deb.sh`](build-deb.sh).

### Building the `.deb`
On any Debian/Ubuntu machine, Kali NetHunter chroot, or Raspberry Pi:
```bash
chmod +x build-deb.sh
./build-deb.sh
```
This generates `emittr_1.3.0_all.deb` in seconds.

### Installing with APT
```bash
sudo apt install ./emittr_1.3.0_all.deb
```
> **Why `apt install ./emittr_*.deb` instead of `dpkg -i`?**  
> `apt install` automatically resolves and installs any missing runtime dependencies (`python3`, `iptables`, `curl`) from system repositories.

---

## 🌐 2. Hosting Your Own APT Repository (via GitHub Pages)

You can host an official APT repository for Emittr on GitHub Pages at zero cost:

### How it Works:
1. When you tag a release (e.g. `v1.3.0`), GitHub Actions automatically builds `emittr_1.3.0_all.deb`.
2. The `.deb` is added to a `repo/` directory containing a signed `Packages.gz` and `Release` file.
3. Users add your repository to their system once:

```bash
# 1. Add Emittr GPG signing key
curl -sS https://mr-anjaneyam.github.io/Emittr/repo/KEY.gpg | gpg --dearmor | sudo tee /etc/apt/trusted.gpg.d/emittr.gpg > /dev/null

# 2. Add repository source list
echo "deb [arch=all] https://mr-anjaneyam.github.io/Emittr/repo /" | sudo tee /etc/apt/sources.list.d/emittr.list

# 3. Update & install!
sudo apt update
sudo apt install emittr
```

---

## 🐉 3. Submitting to Kali Linux & NetHunter (Official Repository)

Since Emittr is designed for rooted Android phones and Kali NetHunter USB gadgets, **Kali Linux is the primary upstream repository**.

### Steps to Submit to Kali:
1. **Open a Request for Package (RFP):**
   * Visit the Kali Linux Bug Tracker: **[bugs.kali.org](https://bugs.kali.org)**
   * Click **Report Issue** $\rightarrow$ Category: **"New Tool Request"**
2. **Submit Tool Details:**
   * **Summary:** `[RFP] emittr - Tactical USB HID Deck & Local Network Relay`
   * **Project URL:** `https://github.com/mr-anjaneyam/Emittr`
   * **License:** MIT
   * **Description:**  
     *Turn any rooted Android or NetHunter phone into a hardware-grade USB composite keyboard, precision trackpad, and continuous scrolling deck. Operates with zero host software, speaks native Boot Protocol scancodes (works in BIOS/UEFI), and provides a local network relay for streaming mobile vault credentials across physical USB cables.*
   * **Debian Packaging:** Point to the [`debian/`](debian/) folder in this repository.
3. **Merge Request on GitLab:**
   * Alternatively, fork **[gitlab.com/kalilinux/packages](https://gitlab.com/kalilinux/packages)**, add `emittr`, and open a Merge Request.
4. **Approval & Distribution:**
   * Once accepted by the Kali release team, `emittr` enters `kali-rolling`. Every NetHunter user worldwide can install it immediately with:
     ```bash
     apt update && apt install emittr
     ```

---

## 📱 4. Submitting to Termux (`termux-packages`)

Termux on Android has its own `apt` / `pkg` repository on GitHub.

### Steps to Submit to Termux:
1. Fork **[github.com/termux/termux-packages](https://github.com/termux/termux-packages)**.
2. Create a new directory: `packages/emittr/`.
3. Create `packages/emittr/build.sh`:
   ```bash
   TERMUX_PKG_HOMEPAGE=https://github.com/mr-anjaneyam/Emittr
   TERMUX_PKG_DESCRIPTION="Tactical USB HID Deck and Local Network Air-Gap Relay"
   TERMUX_PKG_LICENSE="MIT"
   TERMUX_PKG_MAINTAINER="Anjaneyam <mr.anjaneyam@gmail.com>"
   TERMUX_PKG_VERSION="1.3.0"
   TERMUX_PKG_SRCURL=https://github.com/mr-anjaneyam/Emittr/archive/v${TERMUX_PKG_VERSION}.tar.gz
   TERMUX_PKG_SHA256=<sha256-of-release-tarball>
   TERMUX_PKG_DEPENDS="python, iptables"
   TERMUX_PKG_PLATFORM_INDEPENDENT=true

   termux_step_make_install() {
       mkdir -p $TERMUX_PREFIX/opt/usb_hid_deck
       cp -r $TERMUX_PKG_SRCDIR/* $TERMUX_PREFIX/opt/usb_hid_deck/
       ln -sf $TERMUX_PREFIX/opt/usb_hid_deck/emittr $TERMUX_PREFIX/bin/emittr
       ln -sf $TERMUX_PREFIX/opt/usb_hid_deck/usbtype $TERMUX_PREFIX/bin/usbtype
   }
   ```
4. Test build using Termux's `./scripts/run-docker.sh ./build-package.sh emittr`.
5. Submit a Pull Request. Once merged, anyone running Termux can install via:
   ```bash
   pkg install emittr
   # or
   apt install emittr
   ```

---

## 🐧 5. Submitting to Debian / Ubuntu

To enter Debian's official archive (`deb.debian.org`):
1. **Find a Sponsor:** Post an RFS (Request for Sponsorship) on **[mentors.debian.net](https://mentors.debian.net/)**.
2. **Debian Policy Compliance:** Verify package compliance with `lintian`:
   ```bash
   lintian emittr_1.3.0_all.deb
   ```
3. A Debian Developer (DD) reviews, uploads to `unstable`, and the package automatically migrates into testing and Ubuntu's universe archive.
