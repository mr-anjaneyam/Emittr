## 📝 Description
<!-- Briefly describe what this PR does and why it is needed. -->

## 🔗 Related Issues
<!-- Link related issues here (e.g. Fixes #12, Closes #34). -->
Fixes #

## 🛠️ Type of Change
- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking addition of functionality)
- [ ] 💥 Breaking change (fix or feature causing existing setups to behave differently)
- [ ] 🎨 UI / UX refinement (styling, responsiveness, accessibility)
- [ ] ⚡ Performance optimization (latency reduction, reduced CPU usage)
- [ ] 📝 Documentation update (guides, README, install scripts)

## 🧪 Hardware & Testing Verification
Please indicate how this change was tested:
- [ ] **Physical Android Device:** Tested on rooted NetHunter hardware via USB-OTG cable
- [ ] **Target OS Tested:**
  - [ ] Windows (10/11)
  - [ ] macOS (Apple Silicon / Intel)
  - [ ] Linux (X11 / Wayland)
  - [ ] BIOS / Pre-boot environment
- [ ] **Modifier Flush Safety:** Verified cable disconnect does not leave stuck <kbd>Ctrl</kbd>/<kbd>Alt</kbd>/<kbd>Shift</kbd> keys
- [ ] **Local PC Simulation:** Tested locally with FastAPI / Uvicorn server
- [ ] **UI Responsiveness:** Verified on mobile viewport (`< 900px`) and desktop layout (`≥ 900px`)

## 📸 Screenshots / Recordings (if applicable)
<!-- Attach screenshots or videos showing UI or functional changes. -->

## ✅ Contributor Checklist
- [ ] My code adheres to the project's code style and conventions.
- [ ] I have commented complex sections, especially kernel ConfigFS or USB HID scancode logic.
- [ ] I have updated the documentation where appropriate.
- [ ] My changes introduce no new linting errors or unhandled exceptions.
