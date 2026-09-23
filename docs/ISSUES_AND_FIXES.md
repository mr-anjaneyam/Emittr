# Emittr — Issues & Fixes

Findings from a design review of the backend (`server.py`, `setup_gadget.py`, `usbtype`) and frontend (`static/app.js`, `static/index.html`). Each issue includes a suggested fix.

---

## 🔴 Security

### 1. Zero authentication on any endpoint
`/api/type`, `/api/key`, `/api/mouse`, `/ws`, etc. have no token, password, or pairing step. Anyone who can reach port `8088` can inject arbitrary keystrokes/mouse input into the target PC.
**Fix:** Require a shared-secret token (generated at install time, shown in the UI/QR code) on every REST call and as part of the WebSocket handshake (query param or first message). Reject unauthenticated requests with 401.

### 2. Bound to `0.0.0.0` instead of `127.0.0.1`
`server.py` runs `uvicorn.run(..., host="0.0.0.0", ...)`, and the README advertises LAN access via `http://<phone-ip>:8088` — anyone on the same Wi-Fi can fully control the connected PC.
**Fix:** Default bind to `127.0.0.1`. Make LAN exposure opt-in via a config flag, and require the token from #1 whenever LAN mode is enabled.

### 3. No TLS/WSS
All traffic, including typed passwords, travels as plaintext HTTP/WS.
**Fix:** Generate a self-signed local cert at install time and serve over HTTPS/WSS, or tunnel LAN access through an authenticated reverse proxy.

### 4. No CSRF protection
State-changing routes are plain `POST` with JSON bodies and no origin/token check.
**Fix:** Require the auth token from #1 in a custom header (e.g. `X-Emittr-Token`) rather than only in the body — headers aren't auto-attached by cross-origin simple requests, closing the CSRF gap.

### 5. Host-header injection in the port-80 redirector
The `Location:` header is built directly from the client-supplied `Host:` line with no validation (`start_http_port80_redirector`).
**Fix:** Ignore the request's `Host` header; redirect to a fixed, server-known hostname/IP (e.g. `hid.keyboard` or the detected local IP) instead.

### 6. World-writable HID device node
`setup_gadget.py` runs `chmod 666 /dev/hidg*`, letting any unprivileged app on the phone write raw HID reports.
**Fix:** Restrict to `chmod 660` and run the server under a dedicated group that owns `/dev/hidg*`, instead of opening it to all local processes.

### 7. Marketing/reality mismatch on exposure
The README implies an air-gapped, safe tool, but the default deployment is an unauthenticated LAN-exposed input injector.
**Fix:** Update docs to clearly state the LAN-access mode's risk, and make localhost-only the documented default.

---

## 🟠 Backend Architecture & Concurrency

### 8. Blocking sync calls inside async handlers
`/api/key` and the WebSocket `live_char`/hotkey paths call `hid.press_and_release()` directly, which does real `time.sleep()` — this blocks the entire asyncio event loop per keystroke, stalling all other clients and the watchdog loop.
**Fix:** Wrap these calls in `await loop.run_in_executor(None, hid.press_and_release, mod, code)` the same way `_type_worker` already does for bulk typing.

### 9. Race condition on `is_typing`
The route checks `if hid.is_typing: return 409` before the flag is actually set inside `_type_worker`, so two near-simultaneous `/api/type` calls can both pass the check and run concurrently, interleaving bytes on `/dev/hidg0`.
**Fix:** Set `hid.is_typing = True` synchronously in the route handler (before scheduling the task), guarded by an `asyncio.Lock`, not inside the worker coroutine.

### 10. Shared global `stop_event` / `is_typing` across jobs
No per-job identity means one job's completion/cancellation can affect another concurrent job.
**Fix:** Once #9 is fixed to fully serialize typing jobs, this resolves itself; alternatively, give each job its own `asyncio.Event` and track it in a per-job dict keyed by a request ID.

### 11. Fire-and-forget typing task with no error surface
`current_typing_task` is never awaited or given a done-callback, so unexpected exceptions fail silently.
**Fix:** Attach `task.add_done_callback(...)` to log exceptions and broadcast a `typing_error` WebSocket event to clients.

### 12. No length/rate limits on `/api/type` or `live_char`
No cap on text size or message frequency, allowing accidental or malicious resource exhaustion.
**Fix:** Add a max text length (e.g. 50k chars) returning 413 if exceeded, and a simple token-bucket rate limiter on WebSocket `live_char` messages.

### 13. `setup_gadget.py`'s `force` parameter is unused
Declared in the signature but never referenced — dead/incomplete logic.
**Fix:** Either implement forced re-teardown/rebuild of the gadget when `force=True`, or remove the parameter until it's needed.

### 14. Hardcoded UDC name (`hisi-usb-otg`)
`get_usb_status()` dynamically discovers the real UDC from `/sys/class/udc/*`, but the bind step always writes the hardcoded HiSilicon name, silently failing on other chipsets.
**Fix:** Reuse the same dynamic discovery to read the actual UDC name from `/sys/class/udc/*` and write that value when binding.

### 15. No manufacturer/product USB strings configured
The gadget never writes `strings/0x409/manufacturer` or `product`, so it won't enumerate with any custom identity as the marketing implies.
**Fix:** Add a strings directory (`strings/0x409`) with `manufacturer`, `product`, and `serialnumber` entries during gadget init.

### 16. Typing speed floor contradicts the UI's "5ms Instant" preset
`press_and_release()` enforces a ~20ms/char minimum (`max(0.012, delay_s)` hold + `0.008s` gap) regardless of the requested delay.
**Fix:** Either lower the internal floor to genuinely support ~5ms round trips, or update the UI preset labels/slider range to reflect the real achievable minimum.

### 17. Blocking filesystem I/O inside the async watchdog loop
`ensure_hid_gadget()` runs synchronous `os.path.exists` calls every 1.5s directly inside `connection_monitor_loop`.
**Fix:** Wrap the watchdog's gadget-check step in `run_in_executor` as well, keeping the event loop free.

---

## 🟡 Frontend / UX

### 18. Generic error toasts hide root cause
Most `fetch()` calls collapse all failure modes (network down vs. bad request vs. server error) into the same toast text.
**Fix:** Branch on HTTP status / caught exception type and show distinct messages (e.g. "Server unreachable" vs. "Request rejected: <msg>").

### 19. Fixed 2-second WebSocket reconnect with no backoff
`initWebSocket()` retries every 2s indefinitely if the server is down.
**Fix:** Use exponential backoff with a cap (e.g. 1s → 2s → 4s → … → 30s max).

### 20. Live keyboard mirror is fragile against autocorrect/predictive text
Diffing a hidden `<input>`'s value against IME engines that rewrite large spans of text can cause incorrect backspace/insert bursts.
**Fix:** Prefer `beforeinput`/`compositionend` events more strictly, and add a UI toggle to disable autocorrect on the hidden input (`autocorrect="off" autocapitalize="off" spellcheck="false"`), which is not currently set.

### 21. No visible session-ownership indicator
The UI shows a USB "Connected" badge but nothing indicates that any other device on the network could equally be driving the session.
**Fix:** Once auth (#1) is added, show the authenticated client count / an "active controller" indicator in the header.

---

## 🟢 Deployment / Reliability

### 22. Installer health-check race condition
`install.sh` backgrounds the server and only `sleep 2` before curling `/api/status`, which can report false negatives on slower boots.
**Fix:** Poll `/api/status` in a retry loop (e.g. up to 10 attempts, 1s apart) instead of a single fixed sleep.

### 23. No log rotation
`/var/log/usb_deck.log` grows unbounded across restarts in `start.sh`, `install.sh`, and `02-usb-deck.sh`.
**Fix:** Use `logging.handlers.RotatingFileHandler` in `server.py` instead of plain stdout redirection, or pipe through `logrotate`/`multilog`.

### 24. Boot script swallows all errors
`02-usb-deck.sh` chains `|| true` on nearly every command, so a genuine failure at boot produces no signal.
**Fix:** Log each step's outcome to a boot-specific log file (e.g. `/data/local/tmp/usb_deck_boot.log`) even when the script continues past failures.

---

## Priority Summary
| Priority | Issues |
|---|---|
| Immediate (security) | #1, #2, #3, #4, #5, #6 |
| High (correctness/concurrency) | #8, #9, #10, #11 |
| Medium (portability/behavior) | #14, #15, #16, #12, #17 |
| Low (polish) | #7, #13, #18–#24 |
