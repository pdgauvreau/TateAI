import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import Reveal from '../components/motion/Reveal'
import SplitText from '../components/motion/SplitText'
import { privacy, terms, EFFECTIVE_DATE } from './legalContent'
import { ease, spring } from '../motion/tokens'
import './Legal.css'

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

/**
 * The privacy policy and the terms.
 *
 * Long-form legal text is the one place on the site where motion has to stay out
 * of the way, so the only animation is a one-time reveal per section and the
 * contents marker. The marker is the useful part: it tracks which section is
 * being read and slides between entries, which turns a wall of text into
 * something a reader can place themselves in.
 */
const Legal = ({ kind }) => {
  const isPrivacy = kind === 'privacy'
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service'
  const sections = isPrivacy ? privacy : terms

  const [activeId, setActiveId] = useState(() => slug(sections[0].heading))
  const sectionRefs = useRef(new Map())

  useEffect(() => {
    window.scrollTo(0, 0)
    setActiveId(slug(sections[0].heading))
  }, [kind, sections])

  /* One observer for every section beats a scroll handler doing the arithmetic.
     The top-biased root margin means a heading counts as "current" once it
     reaches the upper third of the viewport, which is where people read, rather
     than when it first appears at the bottom. */
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    )

    sectionRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [kind, sections])

  return (
    <div className="page legal">
      <DotBackground variant="bare" />

      <div className="legal-layout shell">
        {/* ------------------------------------------------------ side --- */}
        <aside className="legal-side">
          <nav className="toc" aria-label="On this page">
            <span className="toc-head">On this page</span>
            <ul>
              {sections.map((section) => {
                const id = slug(section.heading)
                const active = id === activeId
                return (
                  <li key={id}>
                    <a href={`#${id}`} className={`toc-link ${active ? 'is-active' : ''}`}>
                      {/* A single marker moved between entries, rather than one
                          per entry fading in and out. */}
                      {active && (
                        <motion.span
                          className="toc-marker"
                          layoutId="toc-marker"
                          transition={spring.glide}
                          aria-hidden="true"
                        />
                      )}
                      <span className="toc-text">{section.heading}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </nav>
        </aside>

        {/* ------------------------------------------------------ body --- */}
        <article className="legal-body-col">
          <header className="legal-head">
            <Reveal variant="in">
              <span className="eyebrow">{title}</span>
            </Reveal>
            <h1 className="legal-title">
              <SplitText trigger="mount" by="word" delay={0.2}>
                {title}
              </SplitText>
            </h1>
            <motion.p
              className="legal-date"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              Effective {EFFECTIVE_DATE}
            </motion.p>

            <motion.p
              className="note legal-warning"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.6, ease: ease.out }}
            >
              These describe the service’s actual data flows, but they have not been
              reviewed by a lawyer and are not legal advice.
            </motion.p>
          </header>

          {sections.map((section) => {
            const id = slug(section.heading)
            return (
              <Reveal
                as="section"
                variant="up"
                className="legal-section"
                key={id}
                id={id}
                ref={(el) => sectionRefs.current.set(id, el)}
              >
                <h2 className="legal-heading">{section.heading}</h2>
                <div className="legal-prose">{section.body}</div>
              </Reveal>
            )
          })}

          <Reveal variant="up" className="legal-foot">
            <p className="legal-cross">
              See also our{' '}
              <Link to={isPrivacy ? '/terms' : '/privacy'}>
                {isPrivacy ? 'Terms of Service' : 'Privacy Policy'}
              </Link>
              .
            </p>
            <Link className="btn btn-ghost legal-back" to="/">
              <span className="arrow-back" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 8H4M7.5 4l-4 4 4 4" />
                </svg>
              </span>
              Back to home
            </Link>
          </Reveal>
        </article>
      </div>
    </div>
  )
}

export default Legal
