# OrbMouse 🫧

**A soft, tactile phone mouse prototype with a little jelly-orb companion.**

OrbMouse is a browser-first UI prototype built with React, TypeScript, Vite and Capacitor. Its first development phase focuses on the orb, touch gestures and accessible feedback. Bluetooth HID, microphone capture, speech recognition and host text insertion are not implemented.

## Tech stack

- React + TypeScript + Vite
- A small WebGL 1 shader for the floating clear water sphere, with CSS for the white background and fallback rendering
- Capacitor 8 for a future Android host
- No Three.js, React Three Fiber or animation dependency is required for this phase

## Get started

Use Bun to install dependencies and run the scripts. `bun.lock` is the project's dependency lockfile.

```bash
bun install
bun run dev
```

Open the local URL shown by Vite. Vite listens on all interfaces so the preview can also be opened from a phone on the same network.

### TypeScript check and production build

```bash
bun run typecheck
bun run build
bun run preview
```

`bun run build` runs the TypeScript project check before creating the production bundle.

### Generate an Android project (optional)

Android Studio is not required to keep working on the web UI. To create and build a native host, install a JDK and Android SDK command-line tools, then run:

```bash
bunx cap add android
bunx cap sync android
cd android
# Windows PowerShell:
./gradlew.bat assembleDebug
```

The Android project is generated locally and is not committed in this prototype.

## Interactions

- Drag the orb with one finger to send incremental cursor movement actions. Movement stops as soon as the pointer is released.
- Tap the left or right half for the corresponding simulated mouse click.
- Hold still for about 450 ms to enter a simulated listening state with a soft light pulse. Releasing stops it.
- Moving past the drag threshold cancels the pending tap and long-press timer.
- A second pointer, pointer cancellation, focus loss or a hidden page cancels the gesture safely.
- Keyboard users can focus the orb, use Enter or Space for a left click, Left/Right arrows for either click, and Escape to cancel an active gesture.
- Reduced-motion preferences disable continuous visual animation.

## Current limitations

- The demo transport deliberately sends no events to a computer. The `InputAction` interface is ready for a future transport and remains independent from rendering.
- The whole-surface ripple during a long press is a visual voice preview only; OrbMouse does not request microphone permission or perform recognition.
- Bluetooth pairing, HID reports and Android-specific lifecycle handling belong to a later phase.
- Standard Bluetooth HID keyboard reports do not transmit arbitrary Unicode text. Chinese and mixed-language text insertion needs a separate feasibility test or companion channel.

## Design notes

The screen keeps only the interactive sphere on a white background. A compact WebGL shader draws transparent water, soft reflections and a touch-driven change in the outer silhouette that rebounds toward a sphere. CSS supplies subtle floating motion and a fallback sphere. Pointer deltas are sent immediately, while visual rotation and inertia stay in the renderer.

The upper-right buttons open Settings and Skins. Settings controls pointer sensitivity (0.5–2×) and the stationary long-press delay (350–700 ms). Skins include system, white, black, Cyberpunk, Tokyo and GitHub-inspired palettes. The selected skin and settings are saved locally in the browser; system mode follows the device color scheme.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the interaction state machine and future Android boundaries.

## License

MIT. See [LICENSE](LICENSE).
