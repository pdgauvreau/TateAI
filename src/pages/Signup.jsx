import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

const Signup = () => {
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSubmitting(true)
    const { data, error: signUpError } = await signUp({ email, password, fullName })
    setSubmitting(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // With email confirmation on (the Supabase default), signUp returns a user
    // but no session — the account is not usable until the link is clicked.
    if (data?.session) {
      navigate('/dashboard')
    } else {
      setNotice(`Check ${email} for a confirmation link to finish setting up your account.`)
    }
  }

  return (
    <div className="auth-page">
      <DotBackground />
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-label">// CREATE ACCOUNT</div>
        <h1 className="auth-title">Start studying smarter</h1>
        <p className="auth-subtitle">
          Upload your course materials and talk through them with TATE AI.
        </p>

        {error && <div className="auth-message error">{error}</div>}
        {notice && <div className="auth-message success">{notice}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
            <span className="auth-hint">At least 8 characters.</span>
          </div>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}

export default Signup
