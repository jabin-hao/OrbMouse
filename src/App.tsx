import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { DemoTransport, type InputAction } from './core/input'

type Mode = 'idle' | 'pressed' | 'dragging' | 'listening'
type PointerStart = { id: number; x: number; y: number; lastX: number; lastY: number; started: number; rectLeft: number; rectWidth: number }
const transport = new DemoTransport()
const HOLD_MS = 450
const DRAG_THRESHOLD = 9

export default function App() {
  const [mode, setMode] = useState<Mode>('idle')
  const [status, setStatus] = useState('Ready to play')
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [lastAction, setLastAction] = useState('Touch the orb to begin')
  const start = useRef<PointerStart | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeMode = useRef<Mode>('idle')
  const resetTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  const enterMode = (next: Mode) => { activeMode.current = next; setMode(next) }
  const send = useCallback((action: InputAction) => { void transport.send(action) }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if (start.current !== null) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, started: performance.now(), rectLeft: rect.left, rectWidth: rect.width }
    enterMode('pressed')
    setStatus('Pressing softly…')
    timer.current = setTimeout(() => {
      if (!start.current || activeMode.current !== 'pressed') return
      enterMode('listening')
      setStatus('Listening · preview only')
      setLastAction('Voice input is not connected yet')
      send({ type: 'voice-start' })
    }, HOLD_MS)
  }

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = start.current
    if (!current || current.id !== event.pointerId || activeMode.current === 'listening') return
    if (activeMode.current === 'pressed' && Math.hypot(event.clientX - current.x, event.clientY - current.y) > DRAG_THRESHOLD) {
      resetTimer()
      enterMode('dragging')
    }
    if (activeMode.current !== 'dragging') return
    const dx = event.clientX - current.lastX
    const dy = event.clientY - current.lastY
    current.lastX = event.clientX
    current.lastY = event.clientY
    setRotation(prev => ({ x: prev.x - dy * 0.28, y: prev.y + dx * 0.28 }))
    send({ type: 'move', dx, dy })
    setStatus('Moving cursor · preview')
    setLastAction(`Move Δx ${Math.round(dx)}, Δy ${Math.round(dy)}`)
  }

  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = start.current
    if (!current || current.id !== event.pointerId) return
    resetTimer()
    const previous = activeMode.current
    if (previous === 'listening') {
      send({ type: 'voice-stop' })
      setStatus(cancelled ? 'Voice cancelled' : 'Voice stopped · preview')
    } else if (!cancelled && previous === 'pressed') {
      const button = event.clientX < current.rectLeft + current.rectWidth / 2 ? 'left' : 'right'
      send({ type: 'click', button })
      setStatus(`${button === 'left' ? 'Left' : 'Right'} click · preview`)
      setLastAction(`${button === 'left' ? 'Left' : 'Right'} mouse click`)
    } else if (previous === 'dragging') {
      setStatus('Cursor stopped · preview')
    } else if (cancelled) {
      setStatus('Gesture cancelled')
    }
    start.current = null
    enterMode('idle')
  }

  return (
    <main className="page">
      <section className="app" aria-label="OrbMouse UI prototype">
        <header className="topbar">
          <div className="brand"><div className="brand-mark" aria-hidden="true">✦</div><div><h1>OrbMouse</h1><span>little magic, big moves.</span></div></div>
          <span className="connection"><span className="connection-dot" /> Demo mode</span>
        </header>

        <div className="hero">
          <div className="eyebrow">YOUR LITTLE DESK COMPANION</div>
          <h2>A little touch<br /><em>goes a long way.</em></h2>
          <p>Tap, swirl, or hold the jelly orb.</p>
        </div>

        <div className={`orb-stage mode-${mode}`}>
          <div className="orb-aura" />
          <div
            className={`orb mode-${mode}`}
            role="button"
            tabIndex={0}
            aria-label="Interactive orb, left/right click, drag or hold to talk"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={event => finish(event)}
            onPointerCancel={event => finish(event, true)}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); send({ type: 'click', button: 'left' }); setStatus('Left click · preview'); setLastAction('Left mouse click') } }}
          >
            <div className="orb-shimmer" />
            <div className="orb-grid" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }} />
            <div className="orb-face" aria-hidden="true"><span /><span /><i /></div>
            <div className="orb-voice-ring" />
          </div>
          <div className="orb-shadow" />
        </div>

        <div className="feedback" aria-live="polite">
          <span className={`feedback-dot ${mode === 'listening' ? 'live' : ''}`} />
          <strong>{status}</strong>
          <small>{lastAction}</small>
        </div>

        <div className="tips"><div><b>↖</b><span>Left tap</span><small>Left click</small></div><div><b>↗</b><span>Right tap</span><small>Right click</small></div><div><b>↔</b><span>Swipe</span><small>Move</small></div><div><b>◉</b><span>Hold</span><small>Voice</small></div></div>
        <footer>V0.1 · Interactive preview only · No Bluetooth or microphone access</footer>
      </section>
    </main>
  )
}
