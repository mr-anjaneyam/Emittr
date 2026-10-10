# Security Policy

## Supported Versions

We actively maintain and provide security patches for the latest release branch of Emittr:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.3.x   | :white_check_mark: |
| < 1.3.0 | :x:                |

---

## Reporting a Vulnerability

The Emittr team takes security and hardware integrity seriously. If you discover a security vulnerability, please do **NOT** open a public GitHub issue.

Instead, please disclose it responsibly using one of the following methods:

1. **GitHub Private Vulnerability Reporting (Recommended):**
   Navigate to the [Security tab](https://github.com/mr-anjaneyam/Emittr/security/advisories) on GitHub and click **"Report a vulnerability"**. This opens a private discussion thread with the maintainers.

2. **Maintainer Contact:**
   Contact the repository maintainer directly via GitHub profile: [@mr-anjaneyam](https://github.com/mr-anjaneyam).

### What to Include in Your Report
* Description of the vulnerability and its potential impact.
* Step-by-step proof of concept (PoC) or reproduction steps.
* Details about your test environment (Android ROM, kernel version, browser).
* Proposed patch or mitigation (if available).

We will acknowledge receipt within 48 hours and work with you on a resolution before making any public advisory.

---

## Security Model & Operational Boundaries

Emittr functions as a hardware-level USB Human Interface Device (HID). Target host machines (computers, servers, consoles) inherently trust physical USB keyboard and mouse scancodes. Consequently, anyone who can issue commands to Emittr can type keystrokes onto the target machine.

### Operating Modes & Network Exposure Boundaries

1. **Direct USB Mode (Offline / Maximum Isolation):**
   * The web deck is accessed strictly on the host phone itself via `http://localhost:8088` (or PWA standalone mode).
   * Wi-Fi and mobile data can be completely turned off on the phone.
   * In this configuration, the target machine remains fully air-gapped from any external network, and no network attack surface exists.

2. **Network Relay Mode (Out-of-Band Control):**
   * The server daemon binds on port `8088` (HTTP) and `8443` (HTTPS) across available local network interfaces (`0.0.0.0`) to allow remote deck operation from secondary devices (such as a laptop or daily-driver phone).
   * **Important Advisory:** While enabling TLS (`emittr ssl generate`) encrypts network traffic and secures mobile clipboard APIs in transit, encryption does not restrict which clients on the local network can send input commands.
   * In shared, untrusted, or public wireless environments, do not expose Emittr to untrusted clients. Use private Wi-Fi networks (WPA2/WPA3), create a dedicated mobile hotspot, connect over USB tethering, or restrict access to localhost.

### Upcoming Security Hardening Roadmap

We are actively designing application-level authorization controls:
* **Session Pairing PIN & Bearer Tokens:** Requiring explicit one-time device pairing and token authentication on both REST and WebSocket endpoints.
* **WebSocket Origin Validation:** Strict origin checks preventing cross-site WebSocket hijacking.
* **Localhost-Only Enforcement Flag:** An explicit configuration toggle (`--localhost-only`) to prevent binding to external network interfaces when remote relay is not required.
