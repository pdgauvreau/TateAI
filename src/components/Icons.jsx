import React from 'react'
import { motion } from 'framer-motion'
import { ease } from '../motion/tokens'

/**
 * Line icons that draw themselves.
 *
 * Each path animates `pathLength` from 0 to 1 under the variant names `hidden`
 * and `show`, which are the same names the reveal wrappers use. Framer
 * propagates a parent's variant to every motion child, so an icon inside a card
 * inside a `RevealGroup` draws itself as part of that card's entrance with no
 * wiring at the call site — and stays in sequence with the stagger.
 *
 * `strokeLinecap: round` matters more than it looks: a partially drawn path with
 * butt caps has a visible flat end that reads as a rendering artefact.
 */

const draw = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (i = 0) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.85, ease: ease.out, delay: 0.1 + i * 0.12 },
      opacity: { duration: 0.2, delay: 0.1 + i * 0.12 },
    },
  }),
}

const Svg = ({ children, size = 22 }) => (
  <motion.svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </motion.svg>
)

/* `custom` stages the strokes within one icon, so a two-part glyph assembles in
   a readable order instead of every stroke appearing at once. */
const P = ({ d, i = 0 }) => <motion.path d={d} variants={draw} custom={i} />
const C = ({ cx, cy, r, i = 0 }) => (
  <motion.circle cx={cx} cy={cy} r={r} variants={draw} custom={i} />
)

export const IconUpload = () => (
  <Svg>
    <P d="M12 16V4" />
    <P d="M7.5 8.5 12 4l4.5 4.5" i={1} />
    <P d="M3.5 14.5v3a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5v-3" i={2} />
  </Svg>
)

export const IconTalk = () => (
  <Svg>
    <P d="M3.5 7.5A2.5 2.5 0 0 1 6 5h8a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 1 14 13H8l-4.5 3z" />
    <P d="M17 10h1a2.5 2.5 0 0 1 2.5 2.5v3A2.5 2.5 0 0 1 18 18h-1l-2.5 2.5V18" i={1} />
  </Svg>
)

export const IconGaps = () => (
  <Svg>
    <P d="M3.5 20V9M9 20V4M14.5 20v-7M20 20v-4" />
    <P d="M2 20h20" i={1} />
  </Svg>
)

export const IconVoice = () => (
  <Svg>
    <P d="M12 3.5a2.6 2.6 0 0 1 2.6 2.6v5a2.6 2.6 0 0 1-5.2 0v-5A2.6 2.6 0 0 1 12 3.5z" />
    <P d="M5.5 11a6.5 6.5 0 0 0 13 0" i={1} />
    <P d="M12 17.5V21M9 21h6" i={2} />
  </Svg>
)

export const IconSpaced = () => (
  <Svg>
    <C cx="12" cy="12" r="8.5" />
    <P d="M12 7.5V12l3 2" i={1} />
  </Svg>
)

export const IconPrivate = () => (
  <Svg>
    <P d="M5 10.5V8a7 7 0 0 1 14 0v2.5" />
    <P d="M4.5 10.5h15V19a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 19z" i={1} />
    <C cx="12" cy="15.3" r="1.6" i={2} />
  </Svg>
)

export const IconExam = () => (
  <Svg>
    <P d="M6 3.5h9.5L19 7v13.5H6z" />
    <P d="M9 11.5h7M9 15h5" i={1} />
    <P d="M15 3.5V7h3.5" i={2} />
  </Svg>
)

export const IconLecture = () => (
  <Svg>
    <P d="M3.5 5.5h17v10h-17z" />
    <P d="M12 15.5v3M8.5 20.5h7" i={1} />
    <P d="M7.5 11.5l2.5-2.5 2 2 3-3.5" i={2} />
  </Svg>
)

export const IconAssignment = () => (
  <Svg>
    <P d="M4.5 6.5A2 2 0 0 1 6.5 4.5h7l6 6v9a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2z" />
    <P d="M9 14.5l2 2 4.5-4.5" i={1} />
  </Svg>
)

export const IconMastery = () => (
  <Svg>
    <C cx="12" cy="12" r="3" />
    <C cx="12" cy="12" r="7.5" i={1} />
    <P d="M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4" i={2} />
  </Svg>
)

export const IconExport = () => (
  <Svg>
    <P d="M12 4v10" />
    <P d="M8 10.5l4 3.5 4-3.5" i={1} />
    <P d="M4.5 17v1.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V17" i={2} />
  </Svg>
)
