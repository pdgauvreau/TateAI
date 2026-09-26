import React, { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ease, spring } from '../motion/tokens'

/**
 * Shared pieces for the sign-in and sign-up screens.
 *
 * Both pages want the same field behaviour and the same supporting panel, and
 * the interesting motion here is in the small stuff — a focus ring that grows
 * from the middle, an error that shakes once — so it belongs in one place where
 * it can be got right once.
 */

/**
 * A labelled input with an animated focus rule.
 *
 * The rule is a single element scaled from the centre rather than a border colour
 * change, which is what makes focus feel like the field opening. The label lifts
 * and tints on focus so the eye has something to follow up the form.
 */
export const AuthField = ({
  label,
  hint,
  type = 'text',
  value,
  onChange,
  disabled,
  ...rest
}) => {
  const id = useId()
  const [focused, setFocused] = useState(false)

  return (
    <motion.div
      className={`field ${focused ? 'is-focused' : ''}`}
      variants={{
        hidden: { opacity: 0, y: 16, filter: 'blur(5px)' },
        show: { opacity: 1, y: 0, filter: 'blur(0px)' },
      }}
      transition={{ duration: 0.5, ease: ease.out }}
    >
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-wrap">
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...rest}
        />
        <motion.span
          className="field-rule"
          animate={{ scaleX: focused ? 1 : 0 }}
          transition={{ duration: 0.35, ease: ease.out }}
          aria-hidden="true"
        />
      </div>
      {hint && <span className="field-hint">{hint}</span>}
    </motion.div>
  )
}

/**
 * The error/notice strip.
 *
 * An error shakes exactly once on arrival. Repeating it would be punishing, and a
 * static red box is easy to miss when the reader's eye is still on the button they
 * just pressed. A notice does not shake — nothing has gone wrong.
 */
export const AuthMessage = ({ kind, children }) => (
  <AnimatePresence mode="wait">
    {children ? (
      <motion.div
        key={String(children)}
        className={`note ${kind === 'error' ? 'note-error' : 'note-good'} auth-note`}
        role={kind === 'error' ? 'alert' : 'status'}
        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
        animate={{
          opacity: 1,
          height: 'auto',
          marginBottom: 16,
          x: kind === 'error' ? [0, -7, 6, -4, 0] : 0,
        }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{
          height: { duration: 0.3, ease: ease.out },
          opacity: { duration: 0.2 },
          x: { duration: 0.42, ease: 'easeInOut', delay: 0.1 },
        }}
      >
        {children}
      </motion.div>
    ) : null}
  </AnimatePresence>
)

/**
 * The submit button: label crossfades to a spinner-and-label while in flight, so
 * the control never changes size and the form does not reflow mid-submit.
 */
export const AuthSubmit = ({ busy, idle, working }) => (
  <motion.button
    type="submit"
    className="btn btn-primary auth-submit"
    disabled={busy}
    variants={{
      hidden: { opacity: 0, y: 16 },
      show: { opacity: 1, y: 0 },
    }}
    whileHover={busy ? undefined : { scale: 1.02 }}
    whileTap={busy ? undefined : { scale: 0.98 }}
    transition={spring.snap}
  >
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={busy ? 'busy' : 'idle'}
        className="auth-submit-label"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
      >
        {busy && <span className="auth-spinner" aria-hidden="true" />}
        {busy ? working : idle}
      </motion.span>
    </AnimatePresence>
  </motion.button>
)

/**
 * The panel beside the form on wide screens.
 *
 * Carries one short argument and a looping illustration. Hidden below 900px
 * rather than stacked: on a phone, anything above the form is something to
 * scroll past to reach the thing you came for.
 */
export const AuthAside = ({ title, lines }) => (
  <motion.aside
    className="auth-aside"
    initial={{ opacity: 0, x: 26, filter: 'blur(10px)' }}
    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
    transition={{ duration: 0.8, ease: ease.out, delay: 0.25 }}
    aria-hidden="true"
  >
    <div className="aside-art">
      {/* Concentric rings pulsing outward from a centre: the same "saying it and
          it landing" idea as the brand mark, at ambient speed. */}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="aside-ring"
          animate={{ scale: [0.5, 1.8], opacity: [0.55, 0] }}
          transition={{
            duration: 4.2,
            repeat: Infinity,
            ease: 'easeOut',
            delay: i * 1.4,
          }}
        />
      ))}
      <motion.span
        className="aside-core"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>

    <p className="aside-title">{title}</p>

    <motion.ul
      className="aside-lines"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: 0.1, delayChildren: 0.5 } },
      }}
      initial="hidden"
      animate="show"
    >
      {lines.map((line) => (
        <motion.li
          key={line}
          variants={{
            hidden: { opacity: 0, x: 14 },
            show: { opacity: 1, x: 0 },
          }}
          transition={{ duration: 0.5, ease: ease.out }}
        >
          {line}
        </motion.li>
      ))}
    </motion.ul>
  </motion.aside>
)
