import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import SplitText from '../components/motion/SplitText'
import { AuthAside, AuthField, AuthMessage, AuthSubmit } from '../components/AuthParts'
import { useAuth } from '../context/AuthContext'
import { ease } from '../motion/tokens'
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
    <div className="page auth">
      <DotBackground />

      <div className="auth-layout">
        <motion.div
          className="auth-card panel rim"
          initial={{ opacity: 0, y: 26, scale: 0.97, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: ease.out }}
        >
          <span className="eyebrow">Sign in</span>

          <h1 className="auth-title">
            <SplitText trigger="mount" delay={0.25}>
              Welcome back
            </SplitText>
          </h1>

          <motion.p
            className="auth-sub"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: ease.out, delay: 0.5 }}
          >
            Pick up whichever conversation you left half-finished.
          </motion.p>

          <AuthMessage kind="error">{error}</AuthMessage>
          <AuthMessage kind="good">{notice}</AuthMessage>

          {/* The form is the stagger parent: fields and the button arrive in
              reading order rather than all at once. */}
          <motion.form
            onSubmit={handleSubmit}
            className="auth-form"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } },
            }}
            initial="hidden"
            animate="show"
          >
            <AuthField
              label="Email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />

            <AuthField
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />

            <AuthSubmit busy={submitting} idle="Sign in" working="Signing in…" />
          </motion.form>

          <div className="auth-meta">
            <button type="button" className="auth-link" onClick={handleReset}>
              Forgot your password?
            </button>
          </div>

          <p className="auth-foot">
            Don’t have an account? <Link to="/signup">Create one</Link>
          </p>
        </motion.div>

        <AuthAside
          title="Talking through it is the part that sticks."
          lines={[
            'Your documents stay private to your account',
            'Conversations pick up where you stopped',
            '25 messages a day on the free plan',
          ]}
        />
      </div>
    </div>
  )
}

export default Login
