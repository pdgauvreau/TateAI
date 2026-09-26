import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ease, inView } from '../../motion/tokens'

/**
 * Headline text revealed one word or one character at a time.
 *
 * The details that make this read as typography rather than as an effect:
 *
 * - Words are never split across lines. Each word is its own inline-block, and
 *   characters live inside it, so a character-level reveal still wraps at word
 *   boundaries.
 * - Every word carries a `clip` mask and the characters rise from beneath it, so
 *   letters emerge from the baseline instead of fading in mid-air.
 * - Spaces are rendered as real, unanimated spaces. Animating them produces a
 *   headline whose word gaps visibly breathe.
 * - Screen readers get the whole string once from an `aria-label`; the shards are
 *   hidden, so the text is not read out letter by letter.
 *
 * `children` must be a plain string. Marked-up headlines compose several of
 * these side by side instead (see Hero).
 */
const SplitText = ({
  children,
  as = 'span',
  by = 'char',
  className,
  delay = 0,
  each,
  duration = 0.85,
  y = '110%',
  trigger = 'view',
  ...rest
}) => {
  const text = String(children ?? '')
  const Tag = motion[as] ?? motion.span

  // Characters need a tighter stagger than words or a long headline takes
  // several seconds to finish assembling.
  const step = each ?? (by === 'char' ? 0.026 : 0.075)

  const words = useMemo(() => text.split(' '), [text])

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: step, delayChildren: delay } },
  }

  const shard = {
    hidden: { y, opacity: 0, rotate: by === 'char' ? 6 : 3 },
    show: {
      y: '0%',
      opacity: 1,
      rotate: 0,
      transition: { duration, ease: ease.out },
    },
  }

  const triggerProps =
    trigger === 'view'
      ? { whileInView: 'show', viewport: inView }
      : { animate: 'show' }

  return (
    <Tag
      className={className}
      variants={container}
      initial="hidden"
      {...triggerProps}
      aria-label={text}
      {...rest}
    >
      {words.map((word, w) => (
        <React.Fragment key={`${word}-${w}`}>
          <span className="split-word" aria-hidden="true">
            {by === 'char' ? (
              Array.from(word).map((ch, c) => (
                <motion.span className="split-shard" key={`${ch}-${c}`} variants={shard}>
                  {ch}
                </motion.span>
              ))
            ) : (
              <motion.span className="split-shard" variants={shard}>
                {word}
              </motion.span>
            )}
          </span>
          {/* Outside the mask and outside the animation: a plain space, so word
              gaps stay fixed while the letters move. */}
          {w < words.length - 1 ? (
            <span className="split-space" aria-hidden="true">
              {' '}
            </span>
          ) : null}
        </React.Fragment>
      ))}
    </Tag>
  )
}

export default SplitText
