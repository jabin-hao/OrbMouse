# OrbMouse 🫧

**A cute, tactile phone mouse for standing desks and AI Agent workflows.**

OrbMouse aims to turn an Android phone into a Bluetooth mouse with a delightful jelly-orb interface and push-to-talk input.

> **Project status: V0.1 interactive UI prototype.** The UI runs in the browser. Bluetooth HID, speech-to-text and typing into a host computer are **not implemented yet**. Standard Bluetooth HID keyboard reports do not directly transmit arbitrary Unicode text.

## Tech stack

- React + TypeScript + Vite
- CSS gradients and transforms for the first lightweight jelly-orb prototype
- Capacitor 8 for Android packaging
- Future: Kotlin Capacitor plugin for Android `BluetoothHidDevice` (API 28+) and on-device speech recognition
- No Android Studio required: Android SDK command-line tools + JDK can build the Android app

## Get started

Requires Node.js compatible with Vite 8 (Node 20.19+ or 22.12+).

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.

### Build web app

```bash
npm run build
npm run preview
```

### Generate Android project (first time)

You need JDK, Android SDK command-line tools, SDK Platform/Build-Tools and accepted licenses.

```bash
npm install
npm run build
npx cap add android
npx cap sync android
cd android
# Windows PowerShell:
./gradlew.bat assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

The `android/` directory is intentionally **not committed** in V0.1; generate it locally with the Capacitor CLI. Once the native plugin and Android build are configured, it can be tracked in a subsequent milestone.

## V0.1 interactions

- Drag jelly orb → simulated cursor movement; visual rotation and trailing feedback
- Tap left/right half → simulated primary/secondary mouse click
- Hold still for ~450 ms → simulated listening state, release to finish
- Demo mode clearly states it does not connect to a computer
- Reduced-motion preference supported

## Design principles

1. Cute yet calm, premium soft-glass aesthetics; usable one-handed.
2. Mouse movement must not have inertia, even if the orb's **visual animation** does.
3. No automatic Enter after transcription; the user reviews AI Agent prompts first.
4. Input events must remain independent from rendering and transport.
5. Bluetooth HID mouse can be OS-agnostic; reliable Chinese/Unicode voice text on host OS remains an unresolved limitation without a companion app.

## Roadmap

- [x] V0.1 Interactive orb preview and gesture state machine
- [ ] V0.2 Android native Bluetooth HID service / pairing / mouse reports
- [ ] V0.3 Android speech recognition and permission UX
- [ ] V0.4 Validate Unicode input on Windows/macOS/Linux; optional companion channel where necessary
- [ ] V1.0 Accessibility, testing, release signing and documentation

## License

MIT. See [LICENSE](LICENSE).
