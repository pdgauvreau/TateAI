/**
 * The motion vocabulary for the whole app.
 *
 * Nothing here renders. Components import curves, springs, and variants from
 * this file instead of writing transition objects inline, which is what keeps a
 * card in Features and a card in Pricing feeling like the same product. The
 * cubic-beziers mirror the custom properties in index.css, so a CSS transition
 * and a Framer transition on the same element agree.
 */

/* — Curves —
   Expo/quint out for entrances: fast departure, long settle, which reads as
   "arriving" rather than "sliding". Quart in-out for anything that both leaves
   and arrives, so the midpoint is the fastest moment. */
export const ease = {
  out: [0.16, 1, 0.3, 1],
  outQuint: [0.22, 1, 0.36, 1],
  inOut: [0.76, 0, 0.24, 1],
  /* Overshoots past 1 — only for small elements where the bounce is charming
     rather than sloppy. Never on text blocks or anything with a border people
     are trying to read against. */
  back: [0.34, 1.56, 0.64, 1],
}

/* — Springs —
   Preferred over durations for anything driven by input (pointer, drag, toggle)
   because the response scales with how far the value has to travel. */
export const spring = {
  /** Cursor followers and parallax: loose, trailing, never quite catches up. */
  drift: { type: 'spring', stiffness: 120, damping: 20, mass: 0.6 },
  /** Default for hover and press. Settles in ~300ms with no visible wobble. */
  snap: { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 },
  /** Layout moves (the nav pill, the tab underline) where overlap would smear. */
  glide: { type: 'spring', stiffness: 320, damping: 34 },
  /** Toggles and badges — a deliberate single bounce. */
  pop: { type: 'spring', stiffness: 600, damping: 18, mass: 0.8 },
  /** Scroll-linked progress bars: heavily damped so scrolling never jitters. */
  scroll: { type: 'spring', stiffness: 260, damping: 42, restDelta: 0.001 },
}

export const dur = {
  fast: 0.18,
  base: 0.32,
  slow: 0.62,
  scene: 0.9,
}

/* — Entrance variants —
   Every one of these pairs a transform with a blur. The blur is the whole
   trick: it makes 16px of travel read as depth instead of as a jump, so the
   distances can stay small and the page never feels like it is sliding around.
   `filter` is animated on GPU-composited layers only, on a handful of elements
   at a time, which is why it is affordable here. */

export const fadeUp = {
  hidden: { opacity: 0, y: 22, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: dur.slow, ease: ease.out },
  },
}

export const fadeDown = {
  hidden: { opacity: 0, y: -18, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: dur.slow, ease: ease.out },
  },
}

export const fadeIn = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: dur.slow, ease: ease.out } },
}

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.94, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: dur.slow, ease: ease.out },
  },
}

/** Cards entering from behind the plane of the screen rather than from below. */
export const liftIn = {
  hidden: { opacity: 0, y: 34, rotateX: -8, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.75, ease: ease.out },
  },
}

export const slideLeft = {
  hidden: { opacity: 0, x: 28, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: dur.slow, ease: ease.out },
  },
}

export const slideRight = {
  hidden: { opacity: 0, x: -28, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { duration: dur.slow, ease: ease.out },
  },
}

/**
 * Parent variant for staggered groups.
 *
 * `delayChildren` buys a beat before the first child so the group reads as one
 * gesture with a lead-in, not as items racing the container.
 */
export const stagger = (each = 0.07, delay = 0.05) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: each, delayChildren: delay },
  },
})

/* — Route transitions —
   Scale dips slightly on the way out so the outgoing page recedes rather than
   simply fading, which gives the incoming page somewhere to come from. */
export const pageVariants = {
  initial: { opacity: 0, y: 14, filter: 'blur(8px)' },
  enter: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: ease.out },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.99,
    filter: 'blur(8px)',
    transition: { duration: 0.28, ease: ease.inOut },
  },
}

/** The shared `whileInView` configuration: fire once, slightly before entry. */
export const inView = { once: true, margin: '-12% 0px -12% 0px' }
