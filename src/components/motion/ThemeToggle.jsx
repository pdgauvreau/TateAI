import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { spring } from '../../motion/tokens'
import { useTheme } from '../../motion/hooks'

/**
 * The light/dark switch.
 *
 * Three things animate together, which is what makes one small control feel
 * finished:
 *
 * 1. The knob slides with a `layout` animation, so its travel is derived from
 *    where the two ends actually are rather than from a hard-coded distance —
 *    the track can be restyled without retuning the motion.
 * 2. The icon inside crossfades *and* rotates a quarter turn, so the sun and moon
 *    exchange places rather than blinking.
 * 3. The track's glow follows the knob, so the lit side of the switch is always
 *    the side the knob is on.
 */
const ThemeToggle = ({ className = '' }) => {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      className={`theme-toggle ${dark ? 'is-dark' : 'is-light'} ${className}`}
      role="switch"
      aria-checked={!dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <motion.span
        className="theme-knob"
        layout
        transition={spring.pop}
        /* justifyContent, not x: the knob's position is a layout fact, which is
           what `layout` can animate. */
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            className="theme-icon"
            initial={{ opacity: 0, rotate: -90, scale: 0.4 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.4 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {dark ? <MoonIcon /> : <SunIcon />}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    </button>
  )
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.2 14.6A8.4 8.4 0 1 1 9.4 3.8a6.6 6.6 0 0 0 10.8 10.8z" />
  </svg>
)

export default ThemeToggle
