import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import DotBackground from '../components/DotBackground'
import './Legal.css'

// Deliberately a placeholder rather than boilerplate legal text. Publishing a
// policy that does not describe what the service actually does is worse than
// publishing none — these get written once data handling and payments are real.
const Legal = ({ kind }) => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [kind])

  const title = kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service'

  return (
    <div className="legal-page">
      <DotBackground />
      <div className="legal-container">
        <div className="section-label">// {title.toUpperCase()}</div>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-body">
          TATE AI is still in development and not yet accepting accounts from the
          public. Our {title.toLowerCase()} will be published here before the service
          launches.
        </p>
        <p className="legal-body">
          If you have questions in the meantime, email{' '}
          <a href="mailto:support@tateai.app">support@tateai.app</a>.
        </p>
        <Link className="legal-back" to="/">
          ← Back to home
        </Link>
      </div>
    </div>
  )
}

export default Legal
