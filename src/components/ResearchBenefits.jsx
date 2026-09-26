import React, { useRef } from 'react'
import { motion, useScroll, useSpring, useTransform } from 'framer-motion'
import Reveal, { RevealGroup } from './motion/Reveal'
import SplitText from './motion/SplitText'
import { Marquee, TiltCard } from './motion/Interactive'
import { ease, liftIn } from '../motion/tokens'
import './ResearchBenefits.css'

/**
 * Why talking works, with the citations attached.
 *
 * The findings are qualitative, so the cards carry a named effect and a source
 * rather than an invented percentage — a count-up on a number nobody measured
 * would be the most dishonest thing on the page. What is animated instead is a
 * glyph per card that *draws the shape of the claim*: a rising curve for
 * retention, a loop for retrieval, a decaying sawtooth for spacing.
 */
const benefits = [
  {
    key: 'production',
    effect: 'Production effect',
    claim: 'Saying it beats reading it',
    body: 'Words that are spoken aloud are remembered better than words read silently. Producing the word adds a distinctive trace that silent reading does not.',
    source: 'MacLeod et al., 2010',
    glyph: 'rise',
  },
  {
    key: 'recall',
    effect: 'Retrieval practice',
    claim: 'Pulling it out beats putting it in again',
    body: 'Being made to retrieve something strengthens it more than studying it a second time. Explaining a concept to someone is retrieval whether you meant it to be or not.',
    source: 'Karpicke & Blunt, 2011',
    glyph: 'loop',
  },
  {
    key: 'meta',
    effect: 'Metacognition',
    claim: 'You find out what you only half know',
    body: 'Fluent reading feels like understanding. Saying it out loud is where that illusion breaks, which is what lets you aim the next hour of study.',
    source: 'Dunlosky & Rawson, 2012',
    glyph: 'split',
  },
  {
    key: 'dual',
    effect: 'Dual coding',
    claim: 'Words plus the slide beats either alone',
    body: 'Verbal and visual channels encode separately. Talking through the figure in front of you lays down both, which gives recall two routes in.',
    source: 'Paivio, 1986',
    glyph: 'pair',
  },
  {
    key: 'spaced',
    effect: 'Spaced practice',
    claim: 'Returning beats staying',
    body: 'The same total time spread across days outperforms the same time in one sitting, by a wide margin, on anything measured weeks later.',
    source: 'Cepeda et al., 2006',
    glyph: 'saw',
  },
  {
    key: 'load',
    effect: 'Cognitive load',
    claim: 'A conversation costs less to sustain',
    body: 'Working memory is the bottleneck. A back-and-forth arrives in small pieces and keeps the load low enough that an hour of it is actually bearable.',
    source: 'Sweller, 1988',
    glyph: 'flat',
  },
]

const citations = [
  'MacLeod et al., 2010',
  'Karpicke & Blunt, 2011',
  'Dunlosky & Rawson, 2012',
  'Paivio, 1986',
  'Cepeda et al., 2006',
  'Sweller, 1988',
  'Roediger & Karpicke, 2006',
  'Bjork & Bjork, 2011',
]

const ResearchBenefits = () => {
  const summaryRef = useRef(null)

  /* The summary panel's edge lights up as it is scrolled through, so the closing
     statement arrives rather than simply being there. */
  const { scrollYProgress } = useScroll({
    target: summaryRef,
    offset: ['start 85%', 'end 55%'],
  })
  const sweep = useSpring(scrollYProgress, { stiffness: 220, damping: 40 })
  const sweepPos = useTransform(sweep, [0, 1], ['0%', '100%'])

  return (
    <section id="research" className="section section-edge research">
      <div className="shell">
        <div className="section-head">
          <Reveal variant="in">
            <span className="eyebrow">Research</span>
          </Reveal>
          <SplitText as="h2" by="word" className="section-title">
            None of this is a new idea
          </SplitText>
          <Reveal variant="up" delay={0.15}>
            <p className="section-sub">
              Talking through material is one of the best-studied things in cognitive
              psychology. TATE AI is a way to do it at eleven at night with nobody
              else awake.
            </p>
          </Reveal>
        </div>

        <Reveal variant="in" className="cite-strip">
          <Marquee speed={44}>
            {citations.map((c) => (
              <span className="cite" key={c}>
                {c}
              </span>
            ))}
          </Marquee>
        </Reveal>

        <RevealGroup className="research-grid" each={0.08}>
          {benefits.map((b) => (
            <TiltCard key={b.key} className="research-card panel rim" variants={liftIn} max={6}>
              <div className="research-top">
                <span className="research-effect">{b.effect}</span>
                <Glyph kind={b.glyph} />
              </div>
              <h3 className="research-claim">{b.claim}</h3>
              <p className="research-body">{b.body}</p>
              <span className="research-source">{b.source}</span>
            </TiltCard>
          ))}
        </RevealGroup>

        <Reveal variant="up" className="summary-wrap">
          <div className="summary panel rim" ref={summaryRef}>
            {/* A highlight travelling along the top edge, positioned by scroll. */}
            <motion.span
              className="summary-sweep"
              style={{ left: sweepPos }}
              aria-hidden="true"
            />
            <span className="eyebrow">The short version</span>
            <p className="summary-text">
              Passive review feels productive and mostly is not. Active, spoken,
              spaced-out recall is slower, more uncomfortable, and works
              considerably better. The uncomfortable part is why almost nobody does
              it alone — so the point of this product is to give you something to
              talk to at the hour you are actually studying.
            </p>
            <p className="summary-caveat">
              These are findings about how people learn, not claims about this app.
              Nobody has run a trial on TATE AI.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * A small line drawing whose shape restates the finding.
 *
 * Drawn with `pathLength` under the `hidden`/`show` variants, so each one is
 * dealt out as part of its card's entrance (see Icons.jsx for the same trick).
 * The repeating half is deliberately slight: a looping animation in all six
 * cards at once would be unreadable, so only the accent moves.
 */
const Glyph = ({ kind }) => {
  const path = {
    rise: 'M2 22 C 10 21, 16 14, 22 10 S 32 4, 38 3',
    loop: 'M4 12 C 4 4, 18 4, 18 12 S 32 20, 32 12 M32 12 l4 3 M32 12 l4-3',
    split: 'M2 20 h14 M20 20 h18 M11 20 V6 M29 20 V10',
    pair: 'M3 8 h13 M3 14 h13 M23 6 a6 6 0 1 0 0 12 a6 6 0 1 0 0-12',
    saw: 'M2 20 L8 6 L8 20 L16 8 L16 20 L26 10 L26 20 L38 12',
    flat: 'M2 14 C 10 14, 14 12, 20 12 S 32 13, 38 12',
  }[kind]

  return (
    <motion.svg
      className="glyph"
      viewBox="0 0 40 24"
      width="46"
      height="28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <motion.path
        d={path}
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          show: {
            pathLength: 1,
            opacity: 1,
            transition: {
              pathLength: { duration: 1, ease: ease.out, delay: 0.15 },
              opacity: { duration: 0.25, delay: 0.15 },
            },
          },
        }}
      />
    </motion.svg>
  )
}

export default ResearchBenefits
