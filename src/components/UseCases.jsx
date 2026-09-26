import React, { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Reveal from './motion/Reveal'
import SplitText from './motion/SplitText'
import { ease, spring } from '../motion/tokens'
import { IconAssignment, IconExam, IconLecture, IconMastery } from './Icons'
import './UseCases.css'

/**
 * When people actually reach for this.
 *
 * Built as a real tab set rather than another grid: four cards side by side
 * invite scanning, and this section wants the reader to pick the one that is
 * their situation. The panel slides in the direction of travel, so switching from
 * tab 1 to tab 4 feels like moving right rather than like a dissolve.
 */
const cases = [
  {
    key: 'exam',
    tab: 'Exam prep',
    icon: <IconExam />,
    title: 'Three days out, and rereading has stopped working',
    body: 'Load the past papers and the revision slides, then get asked the questions instead of skimming them. The topics you fumble are the ones that get the remaining hours.',
    beats: [
      'Answer a past-paper question out loud, then get pushed on the hand-waving',
      'Say which topics you dread; start there rather than at chapter one',
      'End with a short list of what is still shaky',
    ],
    line: 'Walk me through why that reaction is spontaneous at 400 K.',
  },
  {
    key: 'lecture',
    tab: 'Lecture review',
    icon: <IconLecture />,
    title: 'Straight after the lecture, while it is still warm',
    body: 'Twenty minutes of talking through the slides you just sat in front of, before the notes go cold and the connection to last week is lost.',
    beats: [
      'Summarise the lecture in four sentences, then get corrected',
      'Tie today’s slides back to the ones from a fortnight ago',
      'Catch the bit you wrote down but did not follow',
    ],
    line: 'You said “therefore” there. What is doing the work in that step?',
  },
  {
    key: 'assignment',
    tab: 'Assignment help',
    icon: <IconAssignment />,
    title: 'Stuck on the brief, not looking for the answer',
    body: 'Upload the prompt and your draft. It reads the requirements with you and asks what you are trying to argue — and stops short of writing it for you, deliberately.',
    beats: [
      'Take apart what the brief is really asking for',
      'Talk through your approach before committing to it',
      'Find the step in your reasoning that does not hold',
    ],
    line: 'Your thesis and your third paragraph are arguing different things.',
  },
  {
    key: 'mastery',
    tab: 'Concept mastery',
    icon: <IconMastery />,
    title: 'One idea that has not clicked in three weeks',
    body: 'Stay on a single concept for as long as it takes, coming at it from a different angle each time, until you can say it plainly without checking the slide.',
    beats: [
      'Explain it, get a harder version of the same question',
      'Try an analogy and have it taken apart',
      'Say it once more, cleanly, from nothing',
    ],
    line: 'Good. Now explain it to someone who has never seen a graph.',
  },
]

const UseCases = () => {
  const [active, setActive] = useState(0)
  // Which way the panel should travel. Derived from the index delta rather than
  // stored per tab, so any jump animates in the right direction.
  const dirRef = useRef(1)

  const select = (next) => {
    dirRef.current = next > active ? 1 : -1
    setActive(next)
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      select((active + 1) % cases.length)
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      select((active - 1 + cases.length) % cases.length)
    }
  }

  const current = cases[active]
  const dir = dirRef.current

  return (
    <section id="use-cases" className="section section-edge cases">
      <div className="shell">
        <div className="section-head">
          <Reveal variant="in">
            <span className="eyebrow">Use cases</span>
          </Reveal>
          <SplitText as="h2" by="word" className="section-title">
            Pick the one that is your week
          </SplitText>
        </div>

        <Reveal variant="up" className="cases-shell panel rim">
          {/* roving tabindex: one stop for the whole set, arrows move within it,
              which is what a tab list is supposed to do. */}
          <div
            className="tabs"
            role="tablist"
            aria-label="Use cases"
            onKeyDown={onKeyDown}
          >
            {cases.map((c, i) => (
              <button
                key={c.key}
                type="button"
                role="tab"
                id={`tab-${c.key}`}
                aria-selected={i === active}
                aria-controls={`panel-${c.key}`}
                tabIndex={i === active ? 0 : -1}
                className={`tab ${i === active ? 'is-active' : ''}`}
                onClick={() => select(i)}
              >
                {i === active && (
                  <motion.span
                    className="tab-bg"
                    layoutId="tab-bg"
                    transition={spring.glide}
                    aria-hidden="true"
                  />
                )}
                <span className="tab-icon">{c.icon}</span>
                <span className="tab-label">{c.tab}</span>
              </button>
            ))}
          </div>

          <div className="case-stage">
            {/* custom passes the direction into the variants so enter and exit
                agree on which side is "away". */}
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div
                key={current.key}
                id={`panel-${current.key}`}
                role="tabpanel"
                aria-labelledby={`tab-${current.key}`}
                className="case-panel"
                custom={dir}
                variants={{
                  enter: (d) => ({ opacity: 0, x: d * 40, filter: 'blur(8px)' }),
                  center: { opacity: 1, x: 0, filter: 'blur(0px)' },
                  leave: (d) => ({ opacity: 0, x: d * -40, filter: 'blur(8px)' }),
                }}
                initial="enter"
                animate="center"
                exit="leave"
                transition={{ duration: 0.42, ease: ease.out }}
              >
                <div className="case-copy">
                  <h3 className="case-title">{current.title}</h3>
                  <p className="case-body">{current.body}</p>

                  <motion.ul
                    className="case-beats"
                    variants={{
                      hidden: {},
                      show: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
                    }}
                    initial="hidden"
                    animate="show"
                  >
                    {current.beats.map((beat) => (
                      <motion.li
                        key={beat}
                        variants={{
                          hidden: { opacity: 0, x: -14 },
                          show: { opacity: 1, x: 0 },
                        }}
                        transition={{ duration: 0.45, ease: ease.out }}
                      >
                        <span className="beat-tick" aria-hidden="true">
                          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 8.5l3.5 3.5L13 5" />
                          </svg>
                        </span>
                        {beat}
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>

                {/* A single line of what it would actually say back. More
                    persuasive than a feature list, and cheap to animate. */}
                <div className="case-quote">
                  <span className="quote-who">TATE AI</span>
                  <motion.p
                    className="quote-line"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: ease.out, delay: 0.25 }}
                  >
                    “{current.line}”
                  </motion.p>
                  <motion.span
                    className="quote-rule"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.7, ease: ease.out, delay: 0.3 }}
                    aria-hidden="true"
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default UseCases
