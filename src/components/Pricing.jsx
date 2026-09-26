import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import DotBackground from './DotBackground'
import Reveal, { RevealGroup } from './motion/Reveal'
import SplitText from './motion/SplitText'
import { Magnetic, TiltCard } from './motion/Interactive'
import { useAuth } from '../context/AuthContext'
import { startCheckout } from '../lib/billing'
import { ease, liftIn, spring } from '../motion/tokens'
import { PLAN_DISPLAY, PLAN_LIMITS } from '../../shared/plans'
import './Pricing.css'

/**
 * Plans, prices, and the checkout hand-off.
 *
 * Prices and limits are read from shared/plans.js rather than written here, so
 * the page cannot claim a number the API does not enforce. The billing behaviour
 * is unchanged from before the redesign: signed-out visitors are sent to signup,
 * and a failed checkout says why and offers the dashboard when the reason is that
 * a subscription already exists.
 */
const Pricing = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pendingPlan, setPendingPlan] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')
  const [pointToManage, setPointToManage] = useState(false)

  const cancelled = searchParams.get('checkout') === 'cancelled'

  const choosePlan = async (planKey) => {
    setCheckoutError('')
    setPointToManage(false)

    // Checkout needs a user to attach the subscription to.
    if (!user) {
      navigate('/signup')
      return
    }

    setPendingPlan(planKey)
    const result = await startCheckout(planKey)
    // startCheckout navigates away on success, so reaching here means it failed.
    setPendingPlan(null)
    setCheckoutError(result.error ?? 'Could not start checkout.')
    setPointToManage(Boolean(result.manage))
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const plans = [
    {
      name: 'Free',
      planKey: null,
      price: null,
      priceLabel: '$0',
      cadence: 'forever',
      description: 'Enough to find out whether talking through your notes suits you.',
      features: [
        `${PLAN_LIMITS.free} messages a day`,
        'PDF upload up to 25 MB a file',
        'Voice in and voice out',
        'Full data export',
      ],
      cta: 'Create an account',
    },
    {
      name: 'Student',
      planKey: 'student',
      price: PLAN_DISPLAY.student.price,
      cadence: '/month',
      description: 'For regular sessions right through the semester.',
      features: [
        `${PLAN_LIMITS.student} messages a day — ${Math.round(
          PLAN_LIMITS.student / PLAN_LIMITS.free
        )}× the free plan`,
        'Everything in Free',
        'Cancel any time, keeps working until renewal',
      ],
      cta: 'Choose Student',
    },
    {
      name: 'Pro',
      planKey: 'pro',
      price: PLAN_DISPLAY.pro.price,
      cadence: '/month',
      description: 'Exam season, several courses at once, long sittings.',
      features: [
        `${PLAN_LIMITS.pro} messages a day — ${Math.round(
          PLAN_LIMITS.pro / PLAN_LIMITS.student
        )}× Student`,
        'Everything in Student',
        'Upgrades apply immediately, downgrades at renewal',
      ],
      popular: true,
      cta: 'Choose Pro',
    },
    {
      name: 'Institution',
      planKey: null,
      price: null,
      priceLabel: 'Custom',
      cadence: '',
      description: 'Departments, cohorts, and anyone who needs an invoice.',
      features: [
        'Unlimited messages',
        'Bulk accounts and admin view',
        'Usage reporting',
        'Onboarding and a named contact',
      ],
      cta: 'Contact sales',
      contact: true,
    },
  ]

  return (
    <div className="page pricing">
      <DotBackground />

      <section className="pricing-top shell">
        <Reveal variant="in">
          <span className="eyebrow">Pricing</span>
        </Reveal>

        <h1 className="pricing-title">
          <SplitText trigger="mount" delay={0.2}>
            Cheap, and mostly
          </SplitText>{' '}
          <SplitText className="serif grad-text" by="word" trigger="mount" delay={0.5}>
            free.
          </SplitText>
        </h1>

        <Reveal variant="up" delay={0.7}>
          <p className="pricing-sub">
            The free plan is a real plan, not a trial. Paid tiers exist for people
            who hit the daily cap, which mostly happens in the last week before an
            exam.
          </p>
        </Reveal>

        <Reveal variant="up" delay={0.85}>
          <p className="pricing-flag">
            <span className="flag-dot" />
            Early access — billing is not switched on yet. Creating an account is
            free, and these are the prices we intend to charge when it opens.
          </p>
        </Reveal>
      </section>

      <section className="shell">
        {/* Status strips animate in and out rather than appearing, so a returning
            Stripe redirect does not slam a red box into the layout. */}
        <AnimatePresence>
          {cancelled && !checkoutError && (
            <motion.div
              className="note pricing-note"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.35, ease: ease.out }}
            >
              Checkout cancelled — you haven’t been charged.
            </motion.div>
          )}

          {checkoutError && (
            <motion.div
              className="note note-error pricing-note"
              role="alert"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.35, ease: ease.out }}
            >
              {checkoutError}
              {pointToManage && (
                <>
                  {' '}
                  <Link to="/dashboard">Go to your dashboard</Link>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <RevealGroup className="plans" each={0.09}>
          {plans.map((plan) => (
            <TiltCard
              key={plan.name}
              className={`plan panel rim ${plan.popular ? 'is-popular' : ''}`}
              variants={liftIn}
              max={5}
              lift={-8}
            >
              {plan.popular && (
                <>
                  {/* A gradient edge that travels round the recommended card.
                      Masked to a 1px ring so it lights the border, not the fill. */}
                  <span className="plan-halo" aria-hidden="true" />
                  <motion.span
                    className="plan-flag"
                    initial={{ opacity: 0, y: -8, scale: 0.8 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ ...spring.pop, delay: 0.35 }}
                  >
                    Most picked
                  </motion.span>
                </>
              )}

              <span className="plan-name">{plan.name}</span>

              <div className="plan-price">
                <span className="plan-amount">
                  {plan.price != null ? `$${plan.price}` : plan.priceLabel}
                </span>
                {plan.cadence && <span className="plan-cadence">{plan.cadence}</span>}
              </div>

              <p className="plan-desc">{plan.description}</p>

              <ul className="plan-features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <motion.span
                      className="plan-tick"
                      aria-hidden="true"
                      variants={{
                        hidden: { scale: 0, rotate: -40 },
                        show: { scale: 1, rotate: 0 },
                      }}
                      transition={spring.pop}
                    >
                      <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 8.5l3.5 3.5L13 5" />
                      </svg>
                    </motion.span>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="plan-action">
                {plan.contact ? (
                  <Magnetic strength={0.14}>
                    <motion.a
                      href="mailto:sales@tateai.app?subject=Institution%20plan%20enquiry"
                      className="btn btn-ghost plan-btn"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring.snap}
                    >
                      {plan.cta}
                    </motion.a>
                  </Magnetic>
                ) : plan.planKey === null ? (
                  <Magnetic strength={0.14}>
                    <Link to="/signup">
                      <motion.span
                        className="btn btn-ghost plan-btn"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={spring.snap}
                      >
                        {plan.cta}
                      </motion.span>
                    </Link>
                  </Magnetic>
                ) : (
                  <Magnetic strength={0.14}>
                    <motion.button
                      type="button"
                      className={`btn plan-btn ${
                        plan.popular ? 'btn-primary' : 'btn-ghost'
                      }`}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={spring.snap}
                      onClick={() => choosePlan(plan.planKey)}
                      disabled={pendingPlan !== null}
                    >
                      {/* The label swaps in place while checkout opens, rather
                          than the button resizing under the cursor. */}
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={pendingPlan === plan.planKey ? 'pending' : 'idle'}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                        >
                          {pendingPlan === plan.planKey
                            ? 'Opening checkout…'
                            : user
                              ? plan.cta
                              : 'Get started'}
                        </motion.span>
                      </AnimatePresence>
                    </motion.button>
                  </Magnetic>
                )}
              </div>
            </TiltCard>
          ))}
        </RevealGroup>
      </section>

      <Faq />
    </div>
  )
}

const faqs = [
  {
    q: 'What does it cost right now?',
    a: 'Nothing. TATE AI is in early access and billing is not switched on. You will hear from us well before that changes.',
  },
  {
    q: 'What can it read?',
    a: 'PDFs up to 25 MB each — lecture slides, assignment briefs, practice exams. Scanned pages with no selectable text cannot be read yet, because there is no OCR step.',
  },
  {
    q: 'How much of a long document does it actually see?',
    a: 'A fixed character budget per conversation, shared evenly across the documents you attach so one long file cannot crowd out the others. That is fine for a set of slides and not enough for a textbook — long documents get truncated.',
  },
  {
    q: 'Can I get my data out?',
    a: 'Yes, from your dashboard, at any time: your profile, your documents, and every conversation, as one file.',
  },
  {
    q: 'Will it do my homework?',
    a: 'No, by design — it asks questions and gives hints rather than finished answers. Following your institution’s rules on AI use is still your responsibility.',
  },
  {
    q: 'What happens if I cancel?',
    a: 'Your plan keeps working until the end of the period you have paid for, then drops to Free. Nothing is deleted.',
  },
]

/**
 * The FAQ, as a proper accordion.
 *
 * `height: auto` is animatable by Framer, so the panel grows to fit its content
 * without anybody measuring anything. One item open at a time keeps the list
 * short enough to scan, and the chevron rotates rather than swapping glyphs.
 */
const Faq = () => {
  const [open, setOpen] = useState(0)

  return (
    <section className="shell pricing-faq">
      <div className="section-head">
        <Reveal variant="in">
          <span className="eyebrow">Questions</span>
        </Reveal>
        <SplitText as="h2" by="word" className="section-title">
          The ones people actually ask
        </SplitText>
      </div>

      <RevealGroup className="faq" each={0.06}>
        {faqs.map((item, i) => {
          const isOpen = open === i
          return (
            <motion.div
              className={`faq-item ${isOpen ? 'is-open' : ''}`}
              key={item.q}
              variants={{
                hidden: { opacity: 0, y: 16 },
                show: { opacity: 1, y: 0 },
              }}
            >
              <button
                type="button"
                className="faq-q"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                <span>{item.q}</span>
                <motion.span
                  className="faq-chev"
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={spring.snap}
                  aria-hidden="true"
                >
                  {/* A plus that rotates into an x — one glyph, two meanings. */}
                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="faq-a-wrap"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{
                      height: { duration: 0.38, ease: ease.out },
                      // Opacity trails the height slightly so text does not appear
                      // before there is room for it.
                      opacity: { duration: 0.25, delay: isOpen ? 0.1 : 0 },
                    }}
                  >
                    <p className="faq-a">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </RevealGroup>
    </section>
  )
}

export default Pricing
