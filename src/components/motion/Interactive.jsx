import React from 'react'
import { motion } from 'framer-motion'
import { spring } from '../../motion/tokens'
import { useCountUp, useMagnetic, useTilt } from '../../motion/hooks'

/**
 * Pointer-reactive primitives: the pieces that respond to input rather than to
 * scroll position.
 */

/**
 * Wraps a control so it leans toward the cursor as the cursor approaches.
 *
 * The pull is applied to an outer wrapper and the press scale to an inner one.
 * Combining both on a single element means the spring driving `x`/`y` and the
 * gesture driving `scale` fight over the same transform, and the press feels
 * mushy.
 */
export const Magnetic = ({ children, className, strength, radius, ...rest }) => {
  const { ref, style } = useMagnetic({ strength, radius })
  return (
    <motion.div ref={ref} className={className} style={style} {...rest}>
      {children}
    </motion.div>
  )
}

/**
 * A card that tilts toward the pointer with a specular highlight tracking the
 * cursor across its surface.
 *
 * The highlight is what makes the tilt legible: rotation alone on a flat card is
 * nearly invisible, but a moving light source reads immediately as a surface
 * catching the light. `--spot-x`/`--spot-y` are handed to CSS rather than
 * applied here so each card's stylesheet decides what the light looks like.
 */
export const TiltCard = ({
  children,
  className = '',
  as = 'div',
  max,
  lift = -6,
  ...rest
}) => {
  const Tag = motion[as] ?? motion.div
  const { ref, handlers, style, hoverScale, glowX, glowY, hovered } = useTilt({ max })

  return (
    <Tag
      ref={ref}
      className={`tilt ${hovered ? 'is-hot' : ''} ${className}`}
      style={{ ...style, '--spot-x': glowX, '--spot-y': glowY }}
      whileHover={{ y: lift, scale: hoverScale, transition: spring.snap }}
      {...handlers}
      {...rest}
    >
      {/* Sits above the card background and below the content. */}
      <span className="tilt-spot" aria-hidden="true" />
      <span className="tilt-body">{children}</span>
    </Tag>
  )
}

/**
 * A number that counts up to its value the first time it is seen, then stops.
 *
 * `prefix`/`suffix` stay outside the animated span so the unit does not jitter
 * as the digit count changes.
 */
export const Counter = ({
  to,
  decimals = 0,
  duration,
  prefix = '',
  suffix = '',
  className,
}) => {
  const { ref, display } = useCountUp(to, { decimals, duration })
  return (
    <span ref={ref} className={className}>
      {prefix}
      {/* Tabular figures: without them the width changes on every frame and the
          surrounding layout twitches for the whole count. */}
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{display}</span>
      {suffix}
    </span>
  )
}

/**
 * A ring that draws itself to a fraction of its circumference.
 *
 * Used for the daily message allowance. Built from two SVG circles with
 * `pathLength` normalised to 1, which lets the progress be expressed as a plain
 * 0–1 number and animated by Framer without any stroke-dash arithmetic.
 */
export const ProgressRing = ({
  value = 0,
  size = 76,
  width = 6,
  children,
  label,
}) => {
  const clamped = Math.max(0, Math.min(1, value))
  // Warn as the allowance runs down: a ring that stays green at 95% used is
  // decoration, not information.
  const tone =
    clamped > 0.9 ? 'var(--danger)' : clamped > 0.7 ? 'var(--warn)' : 'var(--brand-bright)'

  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle
          cx="50"
          cy="50"
          r={50 - width}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={width}
        />
        <motion.circle
          cx="50"
          cy="50"
          r={50 - width}
          fill="none"
          stroke={tone}
          strokeWidth={width}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="1 1"
          initial={{ strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: 1 - clamped }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
          /* Start the arc at twelve o'clock rather than three. */
          style={{ rotate: -90, transformOrigin: '50% 50%' }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  )
}

/**
 * A row of content scrolling forever.
 *
 * The children are rendered twice and the track is translated by exactly -50%,
 * which is the only version of this that loops seamlessly at any width — a
 * pixel-based distance drifts out of alignment as the viewport changes, and the
 * seam then shows on every pass.
 */
export const Marquee = ({
  children,
  speed = 34,
  reverse = false,
  className = '',
  fade = true,
}) => (
  <div className={`marquee ${fade ? 'marquee-fade' : ''} ${className}`}>
    <motion.div
      className="marquee-track"
      animate={{ x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
      transition={{ duration: speed, ease: 'linear', repeat: Infinity }}
    >
      <div className="marquee-set">{children}</div>
      <div className="marquee-set" aria-hidden="true">
        {children}
      </div>
    </motion.div>
  </div>
)

/**
 * A live level meter for the microphone.
 *
 * Fed by nothing — there is no audio analyser in the app — so it animates a
 * plausible idle waveform rather than pretending to visualise real input. It
 * exists to signal "listening" more strongly than a red dot can, and its bars
 * are deliberately irregular in phase so it never looks like a loading spinner.
 */
export const Waveform = ({ active, bars = 5, className = '' }) => (
  <span className={`wave ${className}`} aria-hidden="true">
    {Array.from({ length: bars }).map((_, i) => (
      <motion.span
        key={i}
        className="wave-bar"
        animate={
          active
            ? { scaleY: [0.3, 1, 0.55, 0.85, 0.3] }
            : { scaleY: 0.25 }
        }
        transition={
          active
            ? {
                duration: 1 + (i % 3) * 0.22,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.08,
              }
            : { duration: 0.3 }
        }
      />
    ))}
  </span>
)

/**
 * The three-dot "thinking" indicator, while the model has been asked for a
 * reply but has not sent its first token.
 *
 * Dots travel vertically *and* dim on the same cycle. Bounce alone reads as
 * decoration; adding opacity makes it read as a pulse moving left to right,
 * which is what people recognise as "working".
 */
export const ThinkingDots = ({ className = '' }) => (
  <span className={`dots ${className}`} aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="dots-dot"
        animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
        transition={{
          duration: 1.1,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: i * 0.16,
        }}
      />
    ))}
  </span>
)

