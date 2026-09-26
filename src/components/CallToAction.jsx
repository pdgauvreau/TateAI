import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import Reveal from './motion/Reveal'
import SplitText from './motion/SplitText'
import { Magnetic } from './motion/Interactive'
import { ease, spring } from '../motion/tokens'
import { PLAN_LIMITS } from '../../shared/plans'
import './CallToAction.css'

/**
 * The closing panel.
 *
 * The one place on the page with a genuinely large gesture: the whole card scales
 * up slightly as it comes into view and the aurora behind it rotates, because by
 * this point the reader has scrolled the entire page and a quiet fade would not
 * register.
 */
const CallToAction = () => {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end end'],
  })

  // Settles at 1 exactly when the panel is fully in view, so it is never caught
  // mid-scale while being read.
  const scale = useSpring(useTransform(scrollYProgress, [0, 1], [0.94, 1]), spring.scroll)
  const glow = useTransform(scrollYProgress, [0, 1], [0.3, 1])

  return (
    <section className="section cta-section" ref={ref}>
      <div className="shell">
        <motion.div className="cta panel rim" style={{ scale }}>
          <motion.span className="cta-aurora" style={{ opacity: glow }} aria-hidden="true">
            <motion.span
              className="cta-aurora-inner"
              animate={{ rotate: 360 }}
              transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
            />
          </motion.span>

          <div className="cta-body">
            <Reveal variant="in">
              <span className="eyebrow">Start tonight</span>
            </Reveal>

            <SplitText as="h2" by="word" className="cta-title">
              Go explain something badly
            </SplitText>

            <Reveal variant="up" delay={0.12}>
              <p className="cta-sub">
                That is the useful part. {PLAN_LIMITS.free} messages a day on the free
                plan, no card, and your data exports in one click if you decide this
                is not for you.
              </p>
            </Reveal>

            <Reveal variant="up" delay={0.2} className="cta-actions">
              <Magnetic strength={0.22}>
                <Link to="/signup">
                  <motion.span
                    className="btn btn-primary cta-btn"
                    whileHover={{ scale: 1.035 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring.snap}
                  >
                    Create a free account
                    <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="arrow" aria-hidden="true">
                      <path d="M3 8h9M8.5 4l4 4-4 4" />
                    </svg>
                  </motion.span>
                </Link>
              </Magnetic>

              <Magnetic strength={0.16}>
                <Link to="/pricing">
                  <motion.span
                    className="btn btn-ghost cta-btn"
                    whileHover={{ scale: 1.035 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring.snap}
                  >
                    See the plans
                  </motion.span>
                </Link>
              </Magnetic>
            </Reveal>
          </div>

          {/* A row of thin bars that fill in sequence along the bottom edge.
              Each one overshoots to full height and drops back to its own
              resting height, so the row settles into a skyline rather than a
              flat rule — a row of identical bars at rest reads as a progress
              bar that has stalled. The heights come from a sine rather than a
              random number so they are stable across renders. */}
          <div className="cta-bars" aria-hidden="true">
            {Array.from({ length: 28 }).map((_, i) => {
              const rest = 0.3 + 0.42 * (0.5 + 0.5 * Math.sin(i * 0.9))
              return (
                <motion.span
                  key={i}
                  className="cta-bar"
                  initial={{ scaleY: 0.1, opacity: 0.2 }}
                  whileInView={{
                    scaleY: [0.1, 1, rest],
                    opacity: [0.2, 1, 0.55],
                  }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 1.1,
                    ease: ease.out,
                    delay: i * 0.028,
                  }}
                />
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default CallToAction
