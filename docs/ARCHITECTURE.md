# OrbMouse architecture

## Scope (V0.1)

UI-only gesture prototype. No actual microphone capture, speech recognition, Bluetooth pairing, HID registration, or remote text insertion.

## Layers

- `src/App.tsx`: jelly-orb gesture state machine and feedback
- `src/styles.css`: responsive UI and reduced-motion-aware animations
- `src/core/input.ts`: input-action contract and demo transport
- `capacitor.config.ts`: future Android host project configuration

## Gesture states

- **idle** → pointer down → **pressed**
- **pressed** → movement over 9 px → **dragging**
- **pressed** → after 450 ms without drag → **listening** (demo)
- **pressed** → release → mouse click action (left or right half)
- **dragging** → release → stop immediately, optional visual settling
- **listening** → release → stop demo voice activity

Moving a pointer is represented by an incremental delta; the final Android HID report format will be implemented in a separate transport. Bluetooth HID has limited report ranges, so large deltas may have to be split into multiple reports.

## Android V0.2 implementation plan

1. Generate the Android host with `npx cap add android`.
2. Create a **native Kotlin Capacitor plugin** backed by Android `BluetoothHidDevice` (API 28+).
3. Declare relevant Bluetooth runtime permissions, request only when needed, register HID SDP descriptor and mouse report protocol.
4. Handle host pairing, registration lifecycle, disconnection, report throttling, foreground-service restrictions and OEM differences.
5. Bind the native transport to `InputTransport` and verify on physical Android device + Windows.

> **Important:** Not every Android device supports the HID Device profile. Features cannot be promised until checked at runtime.

## Speech and text insertion

- Prefer Android speech recognition for the phone-side transcript.
- HID keyboard reports send keycodes, **not arbitrary Unicode strings**; reliable Chinese/English mixed text insertion needs its own feasibility test.
- Never assume that speech recognition guarantees host text injection.
- Future optional host companion can provide Unicode text insertion, while standard HID remains the zero-install mouse mode.
- AI prompts should be editable before submission. Never send Enter automatically.
