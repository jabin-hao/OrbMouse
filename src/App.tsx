import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { DemoTransport, type InputAction } from './core/input'
import OrbRenderer, { type OrbImpact, type OrbMode, type OrbMotion } from './components/OrbRenderer'
import ControlPanel, { type OrbSettings, type PanelName, type ThemeName } from './components/ControlPanel'

type Gesture = {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  lastTime: number
  impactX: number
  impactY: number
  button: 'left' | 'right'
  element: HTMLDivElement
}

const transport = new DemoTransport()
const DRAG_THRESHOLD = 9
const defaultSettings: OrbSettings = { sensitivity: 1, holdMs: 450 }
const themeNames: ThemeName[] = ['system', 'white', 'black', 'cyberpunk', 'tokyo', 'github']

function savedTheme(): ThemeName {
  try {
    const value = localStorage.getItem('orbmouse-theme')
    return themeNames.find(theme => theme === value) ?? 'system'
  } catch { return 'system' }
}

function savedSettings(): OrbSettings {
  try {
    const value = JSON.parse(localStorage.getItem('orbmouse-settings') ?? 'null') as Partial<OrbSettings> | null
    return {
      sensitivity: clamp(Number(value?.sensitivity) || 1, 0.5, 2),
      holdMs: clamp(Number(value?.holdMs) || 450, 350, 700),
    }
  } catch { return defaultSettings }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export default function App() {
  const [mode, setMode] = useState<OrbMode>('idle')
  const [webglReady, setWebglReady] = useState(false)
  const [announcement, setAnnouncement] = useState('OrbMouse ready. Tap either half to click, drag to move, or hold to listen.')
  const [panel, setPanel] = useState<PanelName | null>(null)
  const [theme, setTheme] = useState<ThemeName>(savedTheme)
  const [settings, setSettings] = useState<OrbSettings>(savedSettings)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const effectiveTheme = theme === 'system' ? (systemDark ? 'black' : 'white') : theme

  const gestureRef = useRef<Gesture | null>(null)
  const activeModeRef = useRef<OrbMode>('idle')
  const holdTimerRef = useRef<number | null>(null)
  const pointerIdsRef = useRef(new Set<number>())
  const multiplePointersRef = useRef(false)
  const motionRef = useRef<OrbMotion>({ x: 0, y: 0, vx: 0, vy: 0 })
  const impactRef = useRef<OrbImpact>(null)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => { try { localStorage.setItem('orbmouse-theme', theme) } catch { /* storage unavailable */ } }, [theme])
  useEffect(() => { try { localStorage.setItem('orbmouse-settings', JSON.stringify(settings)) } catch { /* storage unavailable */ } }, [settings])

  const send = useCallback((action: InputAction) => {
    void transport.send(action)
  }, [])

  const handleRendererReady = useCallback((ready: boolean) => {
    setWebglReady(ready)
  }, [])

  const enterMode = useCallback((next: OrbMode) => {
    activeModeRef.current = next
    setMode(next)
  }, [])

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current)
    holdTimerRef.current = null
  }, [])

  const releasePointer = useCallback((gesture: Gesture) => {
    if (gesture.element.hasPointerCapture(gesture.pointerId)) {
      gesture.element.releasePointerCapture(gesture.pointerId)
    }
  }, [])

  const cancelGesture = useCallback((message: string) => {
    const gesture = gestureRef.current
    clearHoldTimer()
    if (!gesture) return

    const wasListening = activeModeRef.current === 'listening'
    gestureRef.current = null
    enterMode('idle')
    if (wasListening) send({ type: 'voice-stop' })
    setAnnouncement(`${message}. No mouse action was sent.`)
    releasePointer(gesture)
  }, [clearHoldTimer, enterMode, releasePointer, send])

  const openPanel = (next: PanelName) => {
    cancelGesture('Panel opened')
    setPanel(next)
  }

  useEffect(() => {
    if (!panel) return
    const onEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') setPanel(null) }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [panel])

  const activateClick = useCallback((button: 'left' | 'right', x: number, y: number) => {
    send({ type: 'click', button })
    impactRef.current = { x, y, at: performance.now(), variation: Math.random() }
    setAnnouncement(`${button === 'left' ? 'Left' : 'Right'} click.`)
  }, [send])

  const finishGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    clearHoldTimer()
    const previousMode = activeModeRef.current
    gestureRef.current = null
    enterMode('idle')

    if (previousMode === 'listening') {
      send({ type: 'voice-stop' })
      setAnnouncement(cancelled ? 'Voice preview cancelled.' : 'Voice preview stopped.')
    } else if (cancelled) {
      setAnnouncement('Gesture cancelled. No mouse action was sent.')
    } else if (previousMode === 'pressed') {
      activateClick(gesture.button, gesture.impactX, gesture.impactY)
    } else if (previousMode === 'dragging') {
      setAnnouncement('Cursor movement stopped.')
    }
  }, [activateClick, clearHoldTimer, enterMode, send])

  useEffect(() => {
    const onGlobalPointerDown = (event: PointerEvent) => {
      pointerIdsRef.current.add(event.pointerId)
      const gesture = gestureRef.current
      if (pointerIdsRef.current.size > 1 || (gesture && gesture.pointerId !== event.pointerId)) {
        multiplePointersRef.current = true
        cancelGesture('Use one finger at a time')
      }
    }

    const onGlobalPointerEnd = (event: PointerEvent) => {
      pointerIdsRef.current.delete(event.pointerId)
      if (pointerIdsRef.current.size === 0) multiplePointersRef.current = false
    }

    const onWindowBlur = () => {
      pointerIdsRef.current.clear()
      multiplePointersRef.current = false
      cancelGesture('Gesture cancelled')
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onWindowBlur()
    }

    window.addEventListener('pointerdown', onGlobalPointerDown, true)
    window.addEventListener('pointerup', onGlobalPointerEnd, true)
    window.addEventListener('pointercancel', onGlobalPointerEnd, true)
    window.addEventListener('blur', onWindowBlur)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('pointerdown', onGlobalPointerDown, true)
      window.removeEventListener('pointerup', onGlobalPointerEnd, true)
      window.removeEventListener('pointercancel', onGlobalPointerEnd, true)
      window.removeEventListener('blur', onWindowBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearHoldTimer()
      if (activeModeRef.current === 'listening') send({ type: 'voice-stop' })
    }
  }, [cancelGesture, clearHoldTimer, send])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (multiplePointersRef.current || gestureRef.current !== null) return
    if (event.pointerType === 'mouse' && event.button !== 0) return

    event.preventDefault()
    clearHoldTimer()
    motionRef.current.vx = 0
    motionRef.current.vy = 0

    const rect = event.currentTarget.getBoundingClientRect()
    const x = (2 * (event.clientX - rect.left) / rect.width - 1) * 0.84
    const y = (1 - 2 * (event.clientY - rect.top) / rect.height) * 0.84
    impactRef.current = { x, y, at: performance.now(), variation: Math.random() }
    const gesture: Gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      lastTime: performance.now(),
      impactX: x,
      impactY: y,
      button: event.clientX < rect.left + rect.width / 2 ? 'left' : 'right',
      element: event.currentTarget,
    }

    gestureRef.current = gesture
    event.currentTarget.setPointerCapture(event.pointerId)
    enterMode('pressed')
    setAnnouncement('Orb pressed. Release to click or hold still to listen.')

    holdTimerRef.current = window.setTimeout(() => {
      if (gestureRef.current !== gesture || activeModeRef.current !== 'pressed') return
      enterMode('listening')
      setAnnouncement('Listening preview. Release to stop.')
      send({ type: 'voice-start' })
    }, settings.holdMs)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId || activeModeRef.current === 'listening') return

    if (activeModeRef.current === 'pressed' && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > DRAG_THRESHOLD) {
      clearHoldTimer()
      enterMode('dragging')
      setAnnouncement('Moving cursor.')
    }
    if (activeModeRef.current !== 'dragging') return

    event.preventDefault()
    const dx = event.clientX - gesture.lastX
    const dy = event.clientY - gesture.lastY
    const now = performance.now()
    const deltaSeconds = Math.max((now - gesture.lastTime) / 1000, 0.008)
    gesture.lastX = event.clientX
    gesture.lastY = event.clientY
    gesture.lastTime = now

    const rotationX = -dy * 0.0048
    const rotationY = dx * 0.0048
    const motion = motionRef.current
    motion.x += rotationX
    motion.y += rotationY
    motion.vx = clamp(rotationX / deltaSeconds * 0.32 + motion.vx * 0.68, -3.4, 3.4)
    motion.vy = clamp(rotationY / deltaSeconds * 0.32 + motion.vy * 0.68, -3.4, 3.4)

    // Input deltas are emitted immediately; visual momentum is rendered separately.
    send({ type: 'move', dx: dx * settings.sensitivity, dy: dy * settings.sensitivity })
  }

  const onKeyboardActivate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.repeat) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activateClick('left', -0.28, 0)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      activateClick('left', -0.28, 0)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      activateClick('right', 0.28, 0)
    } else if (event.key === 'Escape' && gestureRef.current) {
      event.preventDefault()
      cancelGesture('Gesture cancelled')
    }
  }

  return (
    <main className={`space-page theme-${effectiveTheme}${panel ? ' panel-open' : ''}`}>
      <section className="space-scene" aria-label="OrbMouse">
        <nav className="top-actions" aria-label="界面选项">
          <button type="button" className="glass-button" onClick={() => openPanel('settings')} aria-label="打开设置" title="设置">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.87-.34l-.09.04a1.7 1.7 0 0 0-1.02 1.56V20H9.14v-.08a1.7 1.7 0 0 0-1.02-1.56l-.09-.04a1.7 1.7 0 0 0-1.87.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 4.6 15l-.04-.09A1.7 1.7 0 0 0 3 13.89h-.08V10.1H3a1.7 1.7 0 0 0 1.56-1.02L4.6 9a1.7 1.7 0 0 0-.34-1.87L4.2 7.07l1.9-1.9.06.06A1.7 1.7 0 0 0 8.03 5l.09-.04A1.7 1.7 0 0 0 9.14 3.4V3.3h5.72v.1a1.7 1.7 0 0 0 1.02 1.56l.09.04a1.7 1.7 0 0 0 1.87-.34l.06-.06 1.9 1.9-.06.06A1.7 1.7 0 0 0 19.4 9l.04.09A1.7 1.7 0 0 0 21 10.1h.08v3.79H21a1.7 1.7 0 0 0-1.56 1.02z"/></svg>
          </button>
          <button type="button" className="glass-button" onClick={() => openPanel('themes')} aria-label="打开皮肤" title="皮肤">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 1.4-3.4 1.5 1.5 0 0 1 1.1-2.6H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/><circle cx="7.5" cy="11" r=".75"/><circle cx="10" cy="7.5" r=".75"/><circle cx="15" cy="7.5" r=".75"/><circle cx="17.5" cy="11" r=".75"/></svg>
          </button>
        </nav>
        <div className="orb-stage">
        <div className="orb-shadow" aria-hidden="true" />
        <div
          className={`water-orb mode-${mode}${webglReady ? ' is-webgl-ready' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Floating water orb. Tap the left or right half to click, drag to move, or hold still to start voice preview."
          aria-pressed={mode === 'pressed' || mode === 'listening'}
          aria-describedby="orb-instructions"
          aria-keyshortcuts="Enter Space ArrowLeft ArrowRight Escape"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={event => finishGesture(event)}
          onPointerCancel={event => finishGesture(event, true)}
          onLostPointerCapture={event => {
            if (gestureRef.current?.pointerId === event.pointerId) {
              cancelGesture(event.pointerType === 'touch' ? 'Touch cancelled' : 'Gesture cancelled')
            }
          }}
          onContextMenu={event => event.preventDefault()}
          onKeyDown={onKeyboardActivate}
        >
          <OrbRenderer mode={mode} motionRef={motionRef} impactRef={impactRef} onReady={handleRendererReady} />
        </div>
        </div>
        <span id="orb-instructions" className="visually-hidden">
          Keyboard: Enter or Space for a left click, Left or Right arrow for a click, Escape to cancel.
        </span>
        <span className="visually-hidden" aria-live="polite" aria-atomic="true">{announcement}</span>
        {panel && <ControlPanel panel={panel} theme={theme} settings={settings} onTheme={setTheme} onSettings={setSettings} onClose={() => setPanel(null)} />}
      </section>
    </main>
  )
}
