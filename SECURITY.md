# Security Policy

## Supported Versions

We actively maintain and provide security patches for the latest release branch of Emittr:

| Version | Supported          |
| ------- | ------------------ |
| 1.3.x   | :white_check_mark: |
| 1.2.x   | :x:                |
| < 1.2.0 | :x:                |

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

## Security Best Practices for Users

* **Local Network Isolation:** By default, Emittr binds on port `8088` on all local network interfaces (`0.0.0.0`) so you can access the Web Deck from your phone or secondary device. When transmitting sensitive passwords over Wi-Fi, ensure your local wireless network is password-protected (WPA2/WPA3) or connect directly via USB network tethering.
* **Hardware Responsibility:** Emittr acts as a genuine USB Human Interface Device. The host machine trusts keystrokes as physical inputs. Ensure only authorized users have access to your Emittr web deck.
