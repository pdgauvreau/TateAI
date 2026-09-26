import React from 'react'
import { motion } from 'framer-motion'
import Reveal, { RevealGroup } from './motion/Reveal'
import { TiltCard, Marquee } from './motion/Interactive'
import SplitText from './motion/SplitText'
import { ease, liftIn } from '../motion/tokens'
import {
  IconExport,
  IconGaps,
  IconPrivate,
  IconSpaced,
  IconTalk,
  IconUpload,
  IconVoice,
} from './Icons'
import './Features.css'

/**
 * What the product does.
 *
 * A bento rather than a uniform six-up grid: the first cell is twice the width
 * and carries a small working diagram, so the section has somewhere for the eye
 * to land before it starts scanning. The wide cell is also the only one with a
 * moving illustration — giving all six their own animation would make the grid
 * unreadable.
 */
const features = [
  {
    key: 'upload',
    tag: 'Upload',
    title: 'Drop in the actual course material',
    body: 'Lecture slides, assignment briefs, practice exams. TATE AI reads the PDF and answers out of your syllabus, not out of the internet.',
    icon: <IconUpload />,
    wide: true,
  },
  {
    key: 'talk',
    tag: 'Converse',
    title: 'Explain it back',
    body: 'Not a search box. It asks follow-ups, pushes on the vague bits, and makes you put the idea in your own words.',
    icon: <IconTalk />,
  },
  {
    key: 'voice',
    tag: 'Voice',
    title: 'Say it out loud',
    body: 'Dictate your side and have replies read back, so a study session sounds like one. No extra app, no per-minute cost.',
    icon: <IconVoice />,
  },
  {
    key: 'gaps',
    tag: 'Gaps',
    title: 'Find the soft spots',
    body: 'The moment you cannot explain something cleanly is the moment you learn it is not solid yet. That is the whole point.',
    icon: <IconGaps />,
  },
  {
    key: 'spaced',
    tag: 'Return',
    title: 'Come back to it',
    body: 'Conversations are kept per document, so picking a topic back up next week starts where you left it rather than from nothing.',
    icon: <IconSpaced />,
  },
  {
    key: 'private',
    tag: 'Private',
    title: 'Your notes stay yours',
    body: 'Files land in private storage scoped to your account, with row-level security on every table. Nobody else can read them.',
    icon: <IconPrivate />,
  },
  {
    key: 'export',
    tag: 'Portable',
    title: 'Leave whenever',
    body: 'Export your profile, documents, and every conversation as one file, from your dashboard, in a click.',
    icon: <IconExport />,
  },
]

const Features = () => (
  <section id="features" className="section section-edge features">
    <div className="shell">
      <div className="section-head">
        <Reveal variant="in">
          <span className="eyebrow">Features</span>
        </Reveal>
        <SplitText as="h2" by="word" className="section-title">
          Everything the studying actually needs
        </SplitText>
        <Reveal variant="up" delay={0.15}>
          <p className="section-sub">
            Seven pieces, one loop: put the material in, talk it through, notice what
            you cannot yet explain.
          </p>
        </Reveal>
      </div>

      <RevealGroup className="bento" each={0.08}>
        {features.map((f) => (
          <TiltCard
            key={f.key}
            className={`bento-card panel rim ${f.wide ? 'is-wide' : ''}`}
            variants={liftIn}
            max={7}
          >
            <span className="bento-icon">{f.icon}</span>
            <span className="bento-tag">{f.tag}</span>
            <h3 className="bento-title">{f.title}</h3>
            <p className="bento-body">{f.body}</p>
            {f.wide && <UploadDiagram />}
          </TiltCard>
        ))}
      </RevealGroup>
    </div>
  </section>
)

/**
 * The wide cell's illustration: three documents feeding one conversation.
 *
 * The bars fill on a staggered loop to suggest reading, and the line down to the
 * chat pulses in the same rhythm, so the two halves read as connected rather
 * than as two separate animations sharing a box.
 */
const UploadDiagram = () => (
  <div className="diagram" aria-hidden="true">
    <div className="diagram-docs">
      {[0, 1, 2].map((i) => (
        <motion.div
          className="diagram-doc"
          key={i}
          initial={{ opacity: 0, y: 12, rotate: (i - 1) * 4 }}
          whileInView={{ opacity: 1, y: 0, rotate: (i - 1) * 4 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: ease.out, delay: 0.25 + i * 0.1 }}
        >
          {[0, 1, 2].map((line) => (
            <motion.span
              className="diagram-line"
              key={line}
              animate={{ scaleX: [0.25, 1, 0.25] }}
              transition={{
                duration: 3.4,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.4 + line * 0.18,
              }}
            />
          ))}
        </motion.div>
      ))}
    </div>

    <motion.span
      className="diagram-feed"
      animate={{ opacity: [0.2, 0.9, 0.2] }}
      transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
    />

    <div className="diagram-out">
      <Marquee speed={26} fade>
        {['entropy', 'state functions', 'reversibility', 'free energy', 'microstates'].map(
          (term) => (
            <span className="diagram-term" key={term}>
              {term}
            </span>
          )
        )}
      </Marquee>
    </div>
  </div>
)

export default Features
