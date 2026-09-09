import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import { useAuth } from '../context/AuthContext'
import './Auth.css'

const Login = () => {
  const { signIn, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Set by ProtectedRoute when it bounces someone here, so they land back where
  // they were trying to go rather than on a generic dashboard.
  const redirectTo = location.state?.from ?? '/dashboard'

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)

    const { error: signInError } = await signIn({ email, password })
    setSubmitting(false)

    if (signInError) {
      setError(signInError.message)
      return
    }
    navigate(redirectTo, { replace: true })
  }

  const handleReset = async () => {
    setError('')
    setNotice('')

    if (!email) {
      setError('Enter your email address first, then request a reset link.')
      return
    }

    const { error: resetError } = await resetPassword(email)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setNotice(`If an account exists for ${email}, a reset link is on its way.`)
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
        <div className="auth-label">// SIGN IN</div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Pick up where you left off.</p>

        {error && <div className="auth-message error">{error}</div>}
        {notice && <div className="auth-message success">{notice}</div>}

        <form onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />
          </div>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-meta">
          <button type="button" className="auth-link-button" onClick={handleReset}>
            Forgot your password?
          </button>
        </div>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/signup">Create one</Link>
        </p>
      </motion.div>
    </div>
  )
}

export default Login
