import React, { useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import Reveal from './motion/Reveal'
import SplitText from './motion/SplitText'
import { ease, spring } from '../motion/tokens'
import './HowItWorks.css'

/**
 * The four-step loop, told as a rail the reader scrolls down.
 *
 * The section is the only place on the page that uses scroll *position* rather
 * than scroll *entry*: the rail's fill, the active step, and the stage's contents
 * are all derived from one `scrollYProgress`. That means scrolling back up
 * un-tells the story in reverse, which is the honest behaviour for something
 * presented as a progress indicator.
 */
const steps = [
  {
    n: '01',
    label: 'Upload',
    title: 'Put the material in',
    body: 'Drag in the PDFs you were given — slides, a problem set, last year’s paper. Text is extracted server-side and the document is marked ready when it can be read.',
    detail: 'thermo_lecture_04.pdf · 2.1 MB · ready',
  },
  {
    n: '02',
    label: 'Frame',
    title: 'Pick what this session covers',
    body: 'Start a conversation over one document or several. Those documents are packed into the model’s context and shared evenly, so no single long file crowds the others out.',
    detail: '3 documents · context packed',
  },
  {
    n: '03',
    label: 'Talk',
    title: 'Explain it in your own words',
    body: 'Type or dictate. It answers from your material, asks the next question, and reads its reply back a sentence at a time if you want to keep your eyes off the screen.',
    detail: 'listening · 00:42',
  },
  {
    n: '04',
    label: 'Notice',
    title: 'Watch where you stall',
    body: 'The sentences you cannot finish are the syllabus. Come back to that document tomorrow and the conversation is still there, waiting to be picked up.',
    detail: '2 topics flagged to revisit',
  },
]

const HowItWorks = () => {
  const sectionRef = useRef(null)
  const [active, setActive] = useState(0)

  /* The rail spans the list, not the section: starting the fill at the top of the
     heading would leave it already half-drawn by the time the first step is on
     screen. */
  const railRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ['start 62%', 'end 68%'],
  })
  const fill = useSpring(scrollYProgress, spring.scroll)

  // The one place a motion value crosses into React state. Rounding to a step
  // index means this fires four times over the whole section, not every frame.
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const next = Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length + 0.15)))
    setActive((prev) => (prev === next ? prev : next))
  })

  const stageY = useTransform(scrollYProgress, [0, 1], [18, -18])

  return (
    <section id="how-it-works" className="section section-edge how" ref={sectionRef}>
      <div className="shell">
        <div className="section-head">
          <Reveal variant="in">
            <span className="eyebrow">How it works</span>
          </Reveal>
          <SplitText as="h2" by="word" className="section-title">
            Four steps, then repeat
          </SplitText>
          <Reveal variant="up" delay={0.15}>
            <p className="section-sub">
              Upload, frame the session, talk it through, notice the gaps. That is the
              entire product.
            </p>
          </Reveal>
        </div>

        <div className="how-layout">
          {/* ------------------------------------------------------ rail --- */}
          <ol className="how-rail" ref={railRef}>
            <span className="rail-track" aria-hidden="true">
              <motion.span
                className="rail-fill"
                style={{ scaleY: fill }}
                aria-hidden="true"
              />
            </span>

            {steps.map((step, i) => (
              <li
                key={step.n}
                className={`rail-step ${i === active ? 'is-active' : ''} ${
                  i < active ? 'is-done' : ''
                }`}
              >
                <span className="rail-node" aria-hidden="true">
                  {/* The halo is a separate element so it can scale past the node
                      without dragging the number with it. */}
                  <AnimatePresence>
                    {i === active && (
                      <motion.span
                        className="rail-halo"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 1.6, opacity: 0 }}
                        transition={{ duration: 0.45, ease: ease.out }}
                      />
                    )}
                  </AnimatePresence>
                  <span className="rail-num">{step.n}</span>
                </span>

                <Reveal className="rail-copy" variant="left">
                  <span className="rail-label">{step.label}</span>
                  <h3 className="rail-title">{step.title}</h3>
                  <p className="rail-body">{step.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>

          {/* ----------------------------------------------------- stage --- */}
          {/* Sticky, so it stays beside whichever step is being read. Its
              contents swap on the active index. */}
          <div className="how-stage-wrap">
            <motion.div className="how-stage panel rim" style={{ y: stageY }}>
              {/* mode="wait" keeps the two states from overlapping inside a box
                  whose height is fixed — a crossfade here would show both
                  headings stacked for 200ms.

                  Everything that names a step lives inside the animated slide,
                  including the chip. Left outside, the chip would flip to the new
                  number while the old step's title was still on screen, and for
                  400ms the panel would contradict itself. */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  className="stage-slide"
                  initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
                  transition={{ duration: 0.4, ease: ease.out }}
                >
                  <div className="stage-head">
                    <span className="stage-chip">Step {steps[active].n}</span>
                    <motion.span
                      className="stage-bead"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      aria-hidden="true"
                    />
                  </div>

                  <span className="stage-label">{steps[active].label}</span>
                  <p className="stage-title">{steps[active].title}</p>
                  <StageArt index={active} />
                  <span className="stage-detail">{steps[active].detail}</span>
                </motion.div>
              </AnimatePresence>

              {/* Segmented progress along the bottom edge. Four bars rather than
                  one, so the reader can see how much of the section is left. */}
              <div className="stage-pips" aria-hidden="true">
                {steps.map((s, i) => (
                  <span key={s.n} className="stage-pip">
                    <motion.span
                      className="stage-pip-fill"
                      animate={{ scaleX: i <= active ? 1 : 0 }}
                      transition={{ duration: 0.45, ease: ease.out }}
                    />
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * A different small animation per step, so the stage is worth looking at each
 * time it changes rather than being a caption in a box.
 */
const StageArt = ({ index }) => {
  if (index === 0) {
    return (
      <div className="art art-drop" aria-hidden="true">
        <motion.span
          className="art-file"
          animate={{ y: [-14, 6, -14] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="art-zone" />
      </div>
    )
  }

  if (index === 1) {
    return (
      <div className="art art-pick" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="art-card"
            animate={{ y: [0, -6, 0], rotate: [(i - 1) * 5, (i - 1) * 3, (i - 1) * 5] }}
            transition={{
              duration: 3 + i * 0.4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.25,
            }}
          />
        ))}
      </div>
    )
  }

  if (index === 2) {
    return (
      <div className="art art-wave" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, i) => (
          <motion.span
            key={i}
            className="art-bar"
            animate={{ scaleY: [0.2, 1, 0.35, 0.8, 0.2] }}
            transition={{
              duration: 1.4 + (i % 5) * 0.2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.045,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="art art-gaps" aria-hidden="true">
      {[0.85, 0.42, 0.68, 0.24].map((v, i) => (
        <span className="art-meter" key={i}>
          <motion.span
            className={`art-meter-fill ${v < 0.5 ? 'is-low' : ''}`}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: v }}
            transition={{ duration: 0.9, ease: ease.out, delay: 0.15 + i * 0.12 }}
          />
        </span>
      ))}
    </div>
  )
}

export default HowItWorks
