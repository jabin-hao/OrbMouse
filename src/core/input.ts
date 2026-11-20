/** Input actions are independent from UI, HID transport and speech services. */
export type InputAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'click'; button: 'left' | 'right' }
  | { type: 'voice-start' }
  | { type: 'voice-stop' }

export interface InputTransport {
  send(action: InputAction): void | Promise<void>
}

/** Intentionally does not control any remote device in V0.1. */
export class DemoTransport implements InputTransport {
  send(_action: InputAction): void {
    // UI-only placeholder. HID transport is planned for V0.2.
  }
}
