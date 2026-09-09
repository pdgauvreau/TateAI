import React from 'react'
import { Link } from 'react-router-dom'
import DotBackground from '../components/DotBackground'
import './Legal.css'

const NotFound = () => (
  <div className="legal-page">
    <DotBackground />
    <div className="legal-container">
      <div className="section-label">// 404</div>
      <h1 className="legal-title">Page not found</h1>
      <p className="legal-body">
        That page doesn&apos;t exist, or it may have moved.
      </p>
      <Link className="legal-back" to="/">
        ← Back to home
      </Link>
    </div>
  </div>
)

export default NotFound
