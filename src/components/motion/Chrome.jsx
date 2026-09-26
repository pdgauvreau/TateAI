import React, { useEffect, useState } from 'react'
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion'
import { pageVariants, spring } from '../../motion/tokens'
import { usePointerSpring } from '../../motion/hooks'

/**
 * App-level chrome: the things that live above every page and persist across
 * navigation.
 */

/**
 * The reading-progress bar across the top of the window.
 *
 * `useScroll` reports raw document progress, which on a trackpad arrives in
 * jerky increments. Passing it through a heavily damped spring is what turns it
 * into a bar that glides. It also fades out at the very top of the page, where a
 * 0%-wide bar is just a stray dot under the navbar.
 */
export const ScrollProgress = () => {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, spring.scroll)
  const opacity = useTransform(scrollYProgress, [0, 0.01, 0.02], [0, 0, 1])

  return (
    <motion.div
      className="scroll-progress"
      style={{ scaleX, opacity }}
      aria-hidden="true"
    />
  )
}

/**
 * A soft light that follows the cursor.
 *
 * Grows slightly over anything interactive, which it detects by walking up
 * from the hovered element rather than by requiring every button to register
 * itself.
 *
 * Suppressed entirely on coarse pointers and under reduced-motion (both handled
 * inside `usePointerSpring`), and always `pointer-events: none`, so it can never
 * intercept a click.
 */
export const CursorGlow = () => {
  const glow = usePointerSpring({ type: 'spring', stiffness: 90, damping: 22, mass: 0.7 })
  const [hot, setHot] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setEnabled(true)

    const interactive = 'a, button, input, textarea, select, label, [role="button"], .tilt'
    const onOver = (event) => {
      const el = event.target
      setHot(Boolean(el instanceof Element && el.closest(interactive)))
    }

    document.addEventListener('pointerover', onOver, { passive: true })
    return () => document.removeEventListener('pointerover', onOver)
  }, [])

  if (!enabled) return null

  return (
    <motion.div
      className="cursor-glow"
      style={{ x: glow.x, y: glow.y }}
      animate={{ opacity: glow.active ? 1 : 0, scale: hot ? 1.35 : 1 }}
      transition={spring.snap}
      aria-hidden="true"
    />
  )
}

/**
 * Wraps a route's contents so it animates in on arrival and out on departure.
 *
 * Paired with `AnimatePresence mode="wait"` in App, which holds the incoming
 * page until the outgoing one has finished leaving — overlapping the two makes
 * both pages briefly visible and doubles the apparent page height, which the
 * scrollbar picks up on. Exit is deliberately much shorter than entry: waiting
 * to leave feels like lag, arriving slowly feels considered.
 */
export const PageTransition = ({ children, className }) => (
  <motion.main
    className={className}
    variants={pageVariants}
    initial="initial"
    animate="enter"
    exit="exit"
  >
    {children}
  </motion.main>
)

/**
 * Hero-only: a value that tracks the pointer's position within a container,
 * exposed as 0–1 so callers can map it to whatever they like.
 *
 * Returned as motion values so a caller can drive twenty layers of parallax from
 * one listener without a single re-render.
 */
export const useContainerPointer = () => {
  const ref = React.useRef(null)
  const nx = useMotionValue(0.5)
  const ny = useMotionValue(0.5)

  const onPointerMove = (event) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    nx.set((event.clientX - r.left) / r.width)
    ny.set((event.clientY - r.top) / r.height)
  }

  const onPointerLeave = () => {
    nx.set(0.5)
    ny.set(0.5)
  }

  return { ref, nx, ny, handlers: { onPointerMove, onPointerLeave } }
}
