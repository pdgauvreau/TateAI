import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Reveal, { RevealGroup, RevealItem } from './motion/Reveal'
import { ease } from '../motion/tokens'
import { useTilt } from '../motion/hooks'
import './Footer.css'

const columns = [
  {
    heading: 'Product',
    links: [
      { to: '/#features', label: 'Features' },
      { to: '/#how-it-works', label: 'How it works' },
      { to: '/#research', label: 'Research' },
      { to: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { to: '/signup', label: 'Create account' },
      { to: '/login', label: 'Sign in' },
      { to: '/dashboard', label: 'Dashboard' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy policy' },
      { to: '/terms', label: 'Terms of service' },
      { href: 'mailto:support@tateai.app', label: 'support@tateai.app' },
    ],
  },
]

const Footer = () => {
  // The wordmark leans very slightly toward the cursor. At this size a couple of
  // degrees is plenty — any more and the type stops sitting on the page.
  const { ref, handlers, style } = useTilt({ max: 3 })

  return (
    <footer className="foot">
      <div className="shell">
        <div className="foot-grid">
          <Reveal variant="up" className="foot-brand">
            <div className="foot-mark">
              <span className="foot-mark-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 9.5a5.5 5.5 0 0 1 5.5-5.5h1" />
                  <path d="M20 14.5a5.5 5.5 0 0 1-5.5 5.5h-1" />
                  <circle cx="8" cy="16" r="2.4" />
                  <circle cx="16" cy="8" r="2.4" />
                </svg>
              </span>
              <span className="foot-mark-word">
                TATE<span className="brand-ai">AI</span>
              </span>
            </div>
            <p className="foot-tag">
              Upload the coursework. Explain it back out loud. Find out what you
              actually know.
            </p>
          </Reveal>

          {columns.map((col) => (
            <RevealGroup className="foot-col" key={col.heading} each={0.05}>
              <RevealItem as="h4" className="foot-head">
                {col.heading}
              </RevealItem>
              {col.links.map((link) => (
                <RevealItem key={link.label}>
                  {link.href ? (
                    <a className="foot-link" href={link.href}>
                      <span>{link.label}</span>
                    </a>
                  ) : (
                    <Link className="foot-link" to={link.to}>
                      <span>{link.label}</span>
                    </Link>
                  )}
                </RevealItem>
              ))}
            </RevealGroup>
          ))}
        </div>

        {/* The oversized wordmark. Clipped at the bottom so it reads as the page
            running out rather than as a headline that happens to be huge. */}
        <motion.div
          className="foot-giant"
          ref={ref}
          style={style}
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 1, ease: ease.out }}
          aria-hidden="true"
          {...handlers}
        >
          <span className="foot-giant-word">TATE AI</span>
        </motion.div>

        <div className="foot-bottom">
          <p>© {new Date().getFullYear()} TATE AI</p>
          <p className="foot-note">
            Early access. Built with React, Supabase, and the Web Speech API.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
