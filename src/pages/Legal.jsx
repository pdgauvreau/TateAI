import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import DotBackground from '../components/DotBackground'
import { privacy, terms, EFFECTIVE_DATE } from './legalContent'
import './Legal.css'

const Legal = ({ kind }) => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [kind])

  const isPrivacy = kind === 'privacy'
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service'
  const sections = isPrivacy ? privacy : terms

  return (
    <div className="legal-page">
      <DotBackground />
      <div className="legal-container">
        <div className="section-label">// {title.toUpperCase()}</div>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-date">Effective {EFFECTIVE_DATE}</p>

        {sections.map((section) => (
          <section key={section.heading} className="legal-section">
            <h2 className="legal-heading">{section.heading}</h2>
            <div className="legal-body">{section.body}</div>
          </section>
        ))}

        <p className="legal-crosslink">
          See also our{' '}
          <Link to={isPrivacy ? '/terms' : '/privacy'}>
            {isPrivacy ? 'Terms of Service' : 'Privacy Policy'}
          </Link>
          .
        </p>

        <Link className="legal-back" to="/">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}

export default Legal
