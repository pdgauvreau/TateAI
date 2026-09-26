import React from 'react'
import { motion } from 'framer-motion'
import * as V from '../../motion/tokens'

const VARIANTS = {
  up: V.fadeUp,
  down: V.fadeDown,
  in: V.fadeIn,
  scale: V.scaleIn,
  lift: V.liftIn,
  left: V.slideLeft,
  right: V.slideRight,
}

/**
 * Reveals its children the first time they scroll into view.
 *
 * The workhorse of the page — almost every block on the marketing site is
 * wrapped in one of these. Two properties matter:
 *
 * - `once` is always on. A section that re-animates every time it is scrolled
 *   past is the single fastest way to make a site feel cheap.
 * - The trigger margin fires slightly *before* the element reaches the viewport,
 *   so the animation is already underway when it becomes visible. Triggering on
 *   exact intersection means the reader watches it start, which draws attention
 *   to the animation instead of to the content.
 *
 * When `as` is given, the wrapper renders that element (`section`, `li`, `h2`…)
 * so revealing something never costs an extra div in the layout.
 */
const Reveal = React.forwardRef(function Reveal(
  { children, variant = 'up', delay = 0, as = 'div', className, style, ...rest },
  ref
) {
  const Tag = motion[as] ?? motion.div
  const base = VARIANTS[variant] ?? V.fadeUp

  // Delay is applied here rather than baked into the variant, so the same
  // variant object stays shared across every consumer.
  const variants = delay
    ? {
        hidden: base.hidden,
        show: {
          ...base.show,
          transition: { ...base.show.transition, delay },
        },
      }
    : base

  return (
    <Tag
      ref={ref}
      className={className}
      style={style}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={V.inView}
      {...rest}
    >
      {children}
    </Tag>
  )
})

/**
 * Parent for a group of `RevealItem`s. Drives the stagger; contributes no
 * animation of its own, so a grid's own layout is untouched.
 */
export const RevealGroup = ({
  children,
  each = 0.07,
  delay = 0.05,
  as = 'div',
  className,
  style,
  ...rest
}) => {
  const Tag = motion[as] ?? motion.div
  return (
    <Tag
      className={className}
      style={style}
      variants={V.stagger(each, delay)}
      initial="hidden"
      whileInView="show"
      viewport={V.inView}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** A child of `RevealGroup`: inherits the parent's `show`, adds no trigger. */
export const RevealItem = ({
  children,
  variant = 'up',
  as = 'div',
  className,
  style,
  ...rest
}) => {
  const Tag = motion[as] ?? motion.div
  return (
    <Tag
      className={className}
      style={style}
      variants={VARIANTS[variant] ?? V.fadeUp}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export default Reveal
