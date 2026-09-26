import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { spring } from './tokens'

/**
 * Motion hooks shared across the app.
 *
 * Two rules hold throughout this file:
 *
 * 1. Pointer- and scroll-driven values are motion values, never React state.
 *    A mousemove that calls setState re-renders the tree sixty times a second;
 *    a mousemove that writes a motion value touches one style property.
 * 2. Every hook checks `useReducedMotion()` and degrades to a still, usable
 *    version of itself rather than switching the feature off — a card that
 *    cannot tilt should still highlight on hover.
 */

/* ------------------------------------------------------------------ tilt --- */

/**
 * 3D tilt plus a spotlight that tracks the pointer across a card.
 *
 * Returns both the rotation springs and raw 0–1 pointer coordinates, because the
 * glow wants the unsmoothed position (it should sit exactly under the cursor)
 * while the rotation wants the spring (it should lag slightly behind).
 */
export function useTilt({ max = 9, scale = 1.015 } = {}) {
  const reduced = useReducedMotion()
  const ref = useRef(null)

  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const [hovered, setHovered] = useState(false)

  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), spring.snap)
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), spring.snap)

  const onPointerMove = useCallback(
    (event) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      px.set((event.clientX - rect.left) / rect.width)
      py.set((event.clientY - rect.top) / rect.height)
    },
    [px, py]
  )

  const onPointerLeave = useCallback(() => {
    setHovered(false)
    // Return to centre rather than freezing wherever the pointer left, so the
    // card settles level.
    px.set(0.5)
    py.set(0.5)
  }, [px, py])

  return {
    ref,
    hovered,
    // Percentages, ready to drop into a radial-gradient position.
    glowX: useTransform(px, (v) => `${v * 100}%`),
    glowY: useTransform(py, (v) => `${v * 100}%`),
    handlers: {
      onPointerMove: reduced ? undefined : onPointerMove,
      onPointerEnter: () => setHovered(true),
      onPointerLeave,
    },
    style: reduced
      ? undefined
      : { rotateX, rotateY, transformPerspective: 900, transformStyle: 'preserve-3d' },
    hoverScale: reduced ? 1 : scale,
  }
}

/* -------------------------------------------------------------- magnetic --- */

/**
 * Pulls an element a short distance toward the pointer while it is nearby, so
 * buttons feel like they want to be clicked.
 *
 * `strength` is a fraction of the distance from the element's centre to the
 * pointer; past about 0.4 the element outruns the cursor and feels broken.
 */
export function useMagnetic({ strength = 0.28, radius = 110 } = {}) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const x = useSpring(0, spring.drift)
  const y = useSpring(0, spring.drift)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    // Bound to the window rather than the element: the pull has to begin before
    // the pointer arrives, which means listening outside the element's own box.
    const onMove = (event) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = event.clientX - cx
      const dy = event.clientY - cy

      if (Math.hypot(dx, dy) < radius + Math.max(rect.width, rect.height) / 2) {
        x.set(dx * strength)
        y.set(dy * strength)
      } else {
        x.set(0)
        y.set(0)
      }
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [reduced, radius, strength, x, y])

  return { ref, style: reduced ? undefined : { x, y } }
}

/* -------------------------------------------------------------- count up --- */

/**
 * Counts to a target the first time the element is seen.
 *
 * Deliberately state-based rather than a motion value: the number is text
 * content, so it has to re-render to change, and one render per frame for a
 * single span is cheap. The frame loop ends at the target instead of running
 * indefinitely.
 */
export function useCountUp(target, { duration = 1.6, decimals = 0 } = {}) {
  const reduced = useReducedMotion()
  const ref = useRef(null)
  const seen = useInView(ref, { once: true, margin: '-15%' })
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!seen) return
    if (reduced) {
      setValue(target)
      return
    }

    let raf = 0
    let start = 0

    const step = (now) => {
      if (!start) start = now
      const t = Math.min((now - start) / (duration * 1000), 1)
      // Ease-out cubic: most of the count happens early, so the last digits
      // land slowly and stay readable.
      setValue(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [seen, target, duration, reduced])

  return { ref, display: value.toFixed(decimals) }
}

/* -------------------------------------------- pointer position (global) --- */

/**
 * The pointer's viewport position as two spring-smoothed motion values, plus a
 * flag for whether it is over the window at all.
 *
 * One listener serves every consumer that needs the cursor, rather than each
 * effect adding its own.
 */
export function usePointerSpring(config = spring.drift) {
  const reduced = useReducedMotion()
  const x = useSpring(-200, config)
  const y = useSpring(-200, config)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (reduced) return
    // Coarse pointers have no hover position to follow.
    if (!window.matchMedia('(pointer: fine)').matches) return

    const onMove = (event) => {
      x.set(event.clientX)
      y.set(event.clientY)
      setActive(true)
    }
    const onLeave = () => setActive(false)

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [reduced, x, y])

  return { x, y, active }
}

/* ------------------------------------------------------------ raf ticker --- */

/**
 * A frame loop that pauses when the tab is hidden or the element is off screen.
 *
 * Canvas backgrounds otherwise burn a core animating pixels nobody can see,
 * which on a laptop is the difference between a warm fan and a quiet one.
 */
export function useVisibleRaf(ref, callback, enabled = true) {
  const onFrame = useRef(callback)
  onFrame.current = callback

  const inView = useInView(ref, { margin: '20%' })

  useEffect(() => {
    if (!enabled || !inView) return

    let raf = 0
    let last = performance.now()
    let running = true

    const loop = (now) => {
      if (!running) return
      const dt = Math.min(now - last, 50) // clamp: a backgrounded tab returns a huge delta
      last = now
      onFrame.current(dt, now)
      raf = requestAnimationFrame(loop)
    }

    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        last = performance.now()
        raf = requestAnimationFrame(loop)
      }
    }

    raf = requestAnimationFrame(loop)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, inView, ref])
}

/* ------------------------------------------------------------- scrolled --- */

/** True once the page has scrolled past `threshold`. Used by the navbar. */
export function useScrolled(threshold = 24) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setScrolled(window.scrollY > threshold)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
    }
  }, [threshold])

  return scrolled
}

/* ----------------------------------------------------------------- theme --- */

const THEME_KEY = 'tateai:theme'

/**
 * Light/dark preference, written to the `data-theme` attribute on <html>.
 *
 * The initial value is read from the DOM rather than from storage, because the
 * inline script in index.html has already resolved it there before React
 * mounted — reading storage again here would duplicate that logic and risk
 * disagreeing with it.
 */
export function useTheme() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || 'dark'
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* private window — the choice still holds for this session */
    }
  }, [theme])

  const toggle = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    []
  )

  return { theme, toggle }
}
