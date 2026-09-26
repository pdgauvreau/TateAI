import React, { useCallback, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useVisibleRaf } from '../motion/hooks'
import './DotBackground.css'

/**
 * The ambient field behind every page.
 *
 * Four layers, cheapest first, each doing a different job:
 *
 * 1. **Aurora** — three large blurred gradients on long, offset loops. This is
 *    what stops a near-black page from reading as flat. Pure CSS transforms on
 *    composited layers, so it costs nothing per frame.
 * 2. **Dot grid** — two CSS gradient layers rather than one element per dot: a
 *    neutral field, and a brand-coloured copy of the same grid revealed through a
 *    mask that follows the cursor. Carried over from the previous
 *    implementation, which got this right.
 * 3. **Constellation** — a canvas of drifting points that link up when they come
 *    close. Points are also pulled gently toward the cursor, so the field reacts
 *    to the reader without following them outright.
 * 4. **Vignette** — a radial darkening at the edges that keeps the corners from
 *    competing with the content.
 *
 * Everything degrades rather than disappearing: with reduced motion or on a
 * touch device you still get the grid, the vignette, and a still constellation.
 * Pointer position is written straight to CSS custom properties, so moving the
 * mouse never re-renders React.
 */

/* Deliberately low. The effect comes from the linking lines, and the number of
   pair comparisons grows with the square of this value. */
const POINTS = 46
const LINK_DIST = 132
const CURSOR_PULL = 92

const DotBackground = ({ variant = 'full' }) => {
  const hostRef = useRef(null)
  const canvasRef = useRef(null)
  const pointsRef = useRef([])
  const pointerRef = useRef({ x: -9999, y: -9999 })
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 })
  const staticRef = useRef(false)

  /* --- grid highlight + canvas pointer, one listener for both --- */
  useEffect(() => {
    const el = hostRef.current
    if (!el) return

    const fine = window.matchMedia('(pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    staticRef.current = reduced
    if (!fine || reduced) return

    let frame = 0
    let pending = null

    const flush = () => {
      frame = 0
      if (!pending) return
      el.style.setProperty('--mx', `${pending.x}px`)
      el.style.setProperty('--my', `${pending.y}px`)
      el.style.setProperty('--highlight', '1')
      pointerRef.current = pending
    }

    // Coalesced to one write per frame; pointermove fires far faster than that.
    const onMove = (event) => {
      pending = { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(flush)
    }

    const onLeave = () => {
      el.style.setProperty('--highlight', '0')
      pointerRef.current = { x: -9999, y: -9999 }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  /* --- canvas sizing --- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      // Cap the device pixel ratio at 2: beyond that the extra pixels are
      // invisible on this content and the fill cost is real.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight

      sizeRef.current = { w, h, dpr }
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`

      // Seed once, then keep positions across resizes so the field does not
      // visibly re-scatter when a window is dragged.
      if (!pointsRef.current.length) {
        pointsRef.current = Array.from({ length: POINTS }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.16,
          vy: (Math.random() - 0.5) * 0.16,
          r: 0.9 + Math.random() * 1.5,
        }))
      }
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const draw = useCallback((dt) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { w, h, dpr } = sizeRef.current
    const points = pointsRef.current
    const pointer = pointerRef.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    // Read the brand colour from CSS rather than hard-coding it, so the canvas
    // follows a theme change along with everything else.
    const styles = getComputedStyle(document.documentElement)
    const rgb = styles.getPropertyValue('--dot-rgb').trim() || '52, 226, 160'

    // Normalise to 60fps so the drift speed is frame-rate independent.
    const t = staticRef.current ? 0 : dt / 16.67

    for (const p of points) {
      p.x += p.vx * t
      p.y += p.vy * t

      // Wrap rather than bounce: bouncing makes the edges of the viewport read
      // as walls, which draws the eye to them.
      if (p.x < -20) p.x = w + 20
      if (p.x > w + 20) p.x = -20
      if (p.y < -20) p.y = h + 20
      if (p.y > h + 20) p.y = -20

      // Ease toward the cursor when close, and let the drift carry them back
      // out. Pulling all the way in would clump every point on the pointer.
      const dx = pointer.x - p.x
      const dy = pointer.y - p.y
      const d = Math.hypot(dx, dy)
      if (d < CURSOR_PULL && d > 0.5) {
        const pull = (1 - d / CURSOR_PULL) * 0.35 * t
        p.x += dx * 0.01 * pull * 10
        p.y += dy * 0.01 * pull * 10
      }

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${rgb}, ${d < 180 ? 0.5 : 0.24})`
      ctx.fill()
    }

    // Links. Only the upper triangle of pairs, and the line fades with distance
    // so the mesh dissolves at its edges instead of ending abruptly.
    ctx.lineWidth = 0.7
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i]
        const b = points[j]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (dist > LINK_DIST) continue

        ctx.strokeStyle = `rgba(${rgb}, ${(1 - dist / LINK_DIST) * 0.16})`
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
  }, [])

  // Runs only while the tab is visible; see useVisibleRaf.
  useVisibleRaf(hostRef, draw, variant !== 'bare')

  return (
    <div className={`ambient ambient-${variant}`} ref={hostRef} aria-hidden="true">
      <div className="ambient-aurora">
        {/* Three blobs on deliberately co-prime durations, so the composite
            pattern takes minutes to repeat instead of looping obviously. */}
        <motion.span
          className="aurora aurora-1"
          animate={{ x: [0, 90, -40, 0], y: [0, -70, 50, 0], scale: [1, 1.15, 0.95, 1] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="aurora aurora-2"
          animate={{ x: [0, -110, 60, 0], y: [0, 60, -80, 0], scale: [1, 0.9, 1.2, 1] }}
          transition={{ duration: 37, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.span
          className="aurora aurora-3"
          animate={{ x: [0, 70, -90, 0], y: [0, 90, 40, 0], scale: [1, 1.2, 1.05, 1] }}
          transition={{ duration: 43, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="ambient-grid ambient-grid-base" />
      <div className="ambient-grid ambient-grid-hot" />

      {variant !== 'bare' && <canvas className="ambient-canvas" ref={canvasRef} />}

      <div className="ambient-vignette" />
    </div>
  )
}

export default DotBackground
