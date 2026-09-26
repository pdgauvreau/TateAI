import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import SplitText from './motion/SplitText'
import { Magnetic, Waveform } from './motion/Interactive'
import { useContainerPointer } from './motion/Chrome'
import { ease, spring } from '../motion/tokens'
import { PLAN_LIMITS } from '../../shared/plans'
import './Hero.css'

/**
 * The scripted exchange that plays in the hero panel.
 *
 * A real product demo rather than a decorative animation: this is exactly what
 * the app does, so the motion is carrying information. The assistant's turn is
 * typed out character by character, which is also how it arrives in the real
 * chat — the hero and the product use the same rhythm on purpose.
 */
const SCRIPT = [
  { role: 'user', text: 'Okay — so entropy is basically how messy a system is?' },
  {
    role: 'ai',
    text: 'Close. Messiness is the picture, not the definition. How many ways could the particles be arranged and still look the same?',
  },
  { role: 'user', text: 'Ah. So it counts arrangements, not mess.' },
  { role: 'ai', text: 'That is the idea. Now say it back without the word messy.' },
]

const TYPE_MS = 17
const HOLD_MS = 1500

const Hero = () => {
  const reduced = useReducedMotion()
  const sectionRef = useRef(null)
  const { ref: stageRef, nx, ny, handlers } = useContainerPointer()

  /* --- scroll-linked exit ---
     The hero recedes as the page moves rather than simply scrolling away: it
     drifts up slower than the scroll, dims, and loses a little scale, so the
     section below appears to pass in front of it. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.94])
  const cueOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0])

  /* --- pointer parallax ---
     Three depths from one pointer position. The distances are small and the
     signs alternate, so the layers separate without anything appearing to slide.
     Written out rather than generated in a loop because each useTransform is a
     hook call and the count has to be identical on every render. */
  const panelX = useSpring(useTransform(nx, [0, 1], [14, -14]), spring.drift)
  const panelY = useSpring(useTransform(ny, [0, 1], [10, -10]), spring.drift)
  const glowX = useSpring(useTransform(nx, [0, 1], [-34, 34]), spring.drift)
  const glowY = useSpring(useTransform(ny, [0, 1], [-24, 24]), spring.drift)
  const chipX = useSpring(useTransform(nx, [0, 1], [-26, 26]), spring.drift)
  const chipY = useSpring(useTransform(ny, [0, 1], [-18, 18]), spring.drift)

  const conversation = useTypedScript(SCRIPT, reduced)

  return (
    <section className="hero" ref={sectionRef}>
      <motion.div
        className="hero-inner shell"
        style={reduced ? undefined : { y: heroY, opacity: heroOpacity, scale: heroScale }}
      >
        <div className="hero-copy">
          <motion.div
            className="hero-badge"
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.7, ease: ease.out, delay: 0.15 }}
          >
            <span className="hero-badge-dot" />
            <span className="eyebrow-text">Study agent</span>
            <span className="hero-badge-sep" />
            <span className="hero-badge-quiet">Early access</span>
          </motion.div>

          {/* Two SplitTexts rather than one, because the second half is set in a
              different face. Their delays are chained by hand so the whole line
              still reads as a single sweep. */}
          <h1 className="hero-title">
            <SplitText trigger="mount" delay={0.35}>
              Learn by
            </SplitText>{' '}
            <SplitText
              className="serif grad-text hero-title-em"
              by="word"
              trigger="mount"
              delay={0.62}
            >
              talking.
            </SplitText>
          </h1>

          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: ease.out, delay: 0.95 }}
          >
            Upload your slides, assignments, and practice exams — then explain them
            back out loud. Saying it in your own words is one of the
            best-evidenced ways to make it stick.
          </motion.p>

          <motion.div
            className="hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: ease.out, delay: 1.1 }}
          >
            <Magnetic strength={0.22}>
              <Link to="/signup">
                <motion.span
                  className="btn btn-primary hero-cta"
                  whileHover={{ scale: 1.035 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring.snap}
                >
                  Start free
                  <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="arrow" aria-hidden="true">
                    <path d="M3 8h9M8.5 4l4 4-4 4" />
                  </svg>
                </motion.span>
              </Link>
            </Magnetic>

            <Magnetic strength={0.16}>
              <a href="#how-it-works">
                <motion.span
                  className="btn btn-ghost hero-cta"
                  whileHover={{ scale: 1.035 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring.snap}
                >
                  How it works
                </motion.span>
              </a>
            </Magnetic>
          </motion.div>

          {/* Product facts, not social proof. Every number here is enforced
              somewhere in the codebase. */}
          <motion.dl
            className="hero-facts"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.09, delayChildren: 1.3 } },
            }}
            initial="hidden"
            animate="show"
          >
            {[
              { k: `${PLAN_LIMITS.free} messages a day`, v: 'Free, no card' },
              { k: '25 MB PDFs', v: 'Slides, briefs, past papers' },
              { k: 'Voice in, voice out', v: 'Talk, and be talked back to' },
            ].map((fact) => (
              <motion.div
                className="hero-fact"
                key={fact.k}
                variants={{
                  hidden: { opacity: 0, y: 14, filter: 'blur(5px)' },
                  show: { opacity: 1, y: 0, filter: 'blur(0px)' },
                }}
                transition={{ duration: 0.6, ease: ease.out }}
              >
                <dt>{fact.k}</dt>
                <dd>{fact.v}</dd>
              </motion.div>
            ))}
          </motion.dl>
        </div>

        {/* ------------------------------------------------------- stage --- */}
        <motion.div
          className="hero-stage"
          ref={stageRef}
          initial={{ opacity: 0, scale: 0.92, filter: 'blur(14px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 1.1, ease: ease.out, delay: 0.45 }}
          {...(reduced ? {} : handlers)}
        >
          <motion.span
            className="stage-glow"
            style={reduced ? undefined : { x: glowX, y: glowY }}
            aria-hidden="true"
          />

          {/* Two rings behind the panel, counter-rotating. Slow enough to be felt
              rather than watched — a 40-second revolution reads as ambience. */}
          <motion.span
            className="stage-ring stage-ring-1"
            animate={{ rotate: 360 }}
            transition={{ duration: 46, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          />
          <motion.span
            className="stage-ring stage-ring-2"
            animate={{ rotate: -360 }}
            transition={{ duration: 64, repeat: Infinity, ease: 'linear' }}
            aria-hidden="true"
          />

          <motion.div
            className="chat panel rim"
            style={reduced ? undefined : { x: panelX, y: panelY }}
          >
            <div className="chat-bar">
              <span className="chat-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="chat-file">thermo_lecture_04.pdf</span>
              <motion.span
                className="chat-live"
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                live
              </motion.span>
            </div>

            <div className="chat-body">
              {/* Default (sync) mode, not popLayout: these bubbles alternate
                  `align-self` between the two edges, and popLayout takes exiting
                  children out of flow in a way that re-sorts the survivors when
                  their cross-axis alignment differs. Nothing exits here except on
                  the script's reset, when they all go at once, so sync is right. */}
              <AnimatePresence initial={false}>
                {conversation.turns.map((turn) => (
                  <motion.div
                    key={turn.key}
                    className={`bubble bubble-${turn.role}`}
                    /* layout is what makes earlier turns slide up as a new one
                       arrives, instead of the list jumping by one row height. */
                    layout
                    initial={{ opacity: 0, y: 22, scale: 0.96, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.97, filter: 'blur(4px)' }}
                    transition={spring.glide}
                  >
                    <span className="bubble-who">
                      {turn.role === 'user' ? 'You' : 'TATE AI'}
                    </span>
                    <p className="bubble-text">
                      {turn.text}
                      {turn.typing && <span className="caret" aria-hidden="true" />}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="chat-foot">
              <span className="chat-input">
                {conversation.listening ? 'Listening…' : 'Explain it back…'}
              </span>
              <span className={`chat-mic ${conversation.listening ? 'is-on' : ''}`}>
                <Waveform active={conversation.listening} bars={4} />
              </span>
            </div>
          </motion.div>

          {/* Source chips: the documents the conversation is drawing on, drifting
              on their own loops at a shallower parallax depth than the panel, so
              they sit in front of it. */}
          <motion.div
            className="chips"
            style={reduced ? undefined : { x: chipX, y: chipY }}
            aria-hidden="true"
          >
            {[
              { label: 'Lecture 04', cls: 'chip-a', dur: 7 },
              { label: 'Problem set 2', cls: 'chip-b', dur: 9 },
              { label: 'Past paper ’24', cls: 'chip-c', dur: 8 },
            ].map((chip, i) => (
              <motion.span
                key={chip.label}
                className={`chip panel ${chip.cls}`}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -9, 0],
                }}
                transition={{
                  opacity: { duration: 0.5, delay: 1.2 + i * 0.16 },
                  scale: { ...spring.pop, delay: 1.2 + i * 0.16 },
                  y: {
                    duration: chip.dur,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.5,
                  },
                }}
              >
                <span className="chip-dot" />
                {chip.label}
              </motion.span>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Scroll cue: a line that fills downward on a loop. Fades out as soon as
          the reader starts scrolling, since by then it has done its job. */}
      <motion.a
        href="#features"
        className="hero-cue"
        style={{ opacity: cueOpacity }}
        aria-label="Scroll to features"
      >
        <span className="hero-cue-label">Scroll</span>
        <span className="hero-cue-rail">
          <motion.span
            className="hero-cue-fill"
            animate={{ y: ['-100%', '100%'] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut' }}
          />
        </span>
      </motion.a>
    </section>
  )
}

/**
 * Drives the scripted conversation: reveals user turns whole, types assistant
 * turns one character at a time, then loops.
 *
 * Kept as a hook so the JSX above stays declarative. Three things it has to get
 * right:
 *
 * - One timer at a time, always cleared. A stray interval here keeps typing into
 *   an unmounted component for the life of the tab.
 * - `listening` is on only while the reader's own turn is being composed, so the
 *   waveform means something.
 * - Under reduced motion it returns the finished exchange immediately and never
 *   starts a timer at all.
 */
function useTypedScript(script, reduced) {
  const [turns, setTurns] = useState([])
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (reduced) {
      setTurns(script.map((s, i) => ({ ...s, typing: false, key: `0-${i}` })))
      return
    }

    let timer
    let cancelled = false
    let step = 0
    // Bumped on every loop. Without it the first turn of a new pass and the
    // first turn of the pass still exiting share a key, and AnimatePresence
    // cannot tell them apart — the bubbles end up interleaved and out of order.
    let cycle = 0

    const runNext = () => {
      if (cancelled) return

      // Loop: clear and start over rather than growing forever.
      if (step >= script.length) {
        timer = setTimeout(() => {
          if (cancelled) return
          setTurns([])
          step = 0
          cycle += 1
          timer = setTimeout(runNext, 700)
        }, 3200)
        return
      }

      const line = script[step]
      const key = `${cycle}-${step}`
      step += 1

      if (line.role === 'user') {
        // The reader's turn arrives whole, preceded by a beat of "listening".
        setListening(true)
        timer = setTimeout(() => {
          if (cancelled) return
          setListening(false)
          setTurns((prev) => [...prev, { ...line, typing: false, key }])
          timer = setTimeout(runNext, 620)
        }, 1100)
        return
      }

      // Assistant turn: append an empty bubble, then fill it.
      setTurns((prev) => [...prev, { ...line, text: '', typing: true, key }])
      let i = 0

      const type = () => {
        if (cancelled) return
        i += 2 // two characters a tick: 17ms per character is too slow to watch
        const slice = line.text.slice(0, i)

        setTurns((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...line, text: slice, typing: i < line.text.length, key }
          return next
        })

        if (i < line.text.length) timer = setTimeout(type, TYPE_MS)
        else timer = setTimeout(runNext, HOLD_MS)
      }

      timer = setTimeout(type, 420)
    }

    timer = setTimeout(runNext, 1500)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [script, reduced])

  return { turns, listening }
}

export default Hero
