# OrbMouse architecture

## Scope (first UI phase)

The app is a browser-first interaction prototype. It does not capture audio, register a Bluetooth HID device, pair to a computer or insert text into a host application.

## Layers

- `src/App.tsx` owns the pointer/keyboard gesture state machine and user feedback.
- `src/components/OrbRenderer.tsx` draws the water sphere, caustics, local touch deformation and visual inertia in a small WebGL 1 fragment shader.
- `src/styles.css` renders the white scene, floating motion, responsive sizing and motion/accessibility preferences.
- `src/core/input.ts` defines the input-action contract and no-op demo transport.
- `capacitor.config.ts` configures the future Android host.

The screen contains only the floating sphere. The custom shader shades a translucent water volume with moving caustics and reflective highlights; a touch distorts the local surface normal and silhouette, then decays with a spring response. CSS provides a static water fallback if WebGL is unavailable. Visual rotation, idle drift and post-release inertia run independently from the input transport and never delay or alter pointer deltas. No rendering or animation dependency is added.

## Input contract

`InputAction` remains unchanged:

- `move` carries incremental `dx` and `dy` values.
- `click` carries either `left` or `right`.
- `voice-start` and `voice-stop` bracket the simulated hold-to-talk state.

`InputTransport.send` is the only boundary between the gesture UI and a future HID or speech service. The current `DemoTransport` is intentionally a no-op.

## Gesture states

- **idle** → primary pointer down → **pressed** and start a 450 ms timer.
- **pressed** → movement beyond 9 CSS pixels → **dragging**, cancel the timer, and emit movement deltas.
- **pressed** → timer expires while still → **listening**, emit `voice-start` once.
- **pressed** → release → emit one click based on the original down position's orb half.
- **dragging** → release → stop movement immediately; only the rendered sphere keeps decaying angular velocity.
- **listening** → release → emit `voice-stop`.
- Any active state → second pointer, pointer cancellation, focus loss or hidden page → cancel without emitting a click; stop voice if it had started.

Pointer capture keeps a single gesture coherent when a finger moves beyond the orb. Global pointer tracking cancels if another pointer appears anywhere on the page and blocks that multi-touch sequence until all pointers are lifted. Pointer-up clears the gesture before the browser releases capture, so the following `lostpointercapture` event cannot send a second action.

## Accessibility and mobile behavior

- The orb is a labelled keyboard button with Enter/Space and arrow-key click actions.
- A visible focus ring and screen-reader live status expose focus and gesture feedback without adding visible text around the sphere.
- The page respects safe-area insets and `prefers-reduced-motion`.
- `touch-action: none` applies only to the orb, preserving normal page scrolling elsewhere.

## Android V0.2 implementation plan

1. Generate the Android host with `bunx cap add android`.
2. Create a native Kotlin Capacitor plugin backed by Android `BluetoothHidDevice` (API 28+).
3. Declare Bluetooth runtime permissions, request them only when needed, register the HID descriptor and mouse report protocol.
4. Handle host pairing, registration lifecycle, disconnection, report throttling, foreground-service restrictions and OEM differences.
5. Bind the native transport to `InputTransport` and verify on physical Android hardware and Windows.

Not every Android device supports the HID Device profile. Device support must be checked at runtime.

## Speech and text insertion

- Prefer Android speech recognition for phone-side transcription.
- HID keyboard reports send keycodes, not arbitrary Unicode strings. Reliable Chinese/English text insertion needs its own feasibility test.
- Never assume speech recognition guarantees host text injection.
- Prompts should remain editable before submission. Never send Enter automatically.
