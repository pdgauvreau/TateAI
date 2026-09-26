import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import SplitText from '../components/motion/SplitText'
import { AuthAside, AuthField, AuthMessage, AuthSubmit } from '../components/AuthParts'
import { useAuth } from '../context/AuthContext'
import { ease } from '../motion/tokens'
import { PLAN_LIMITS } from '../../shared/plans'
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
    <div className="page auth">
      <DotBackground />

      <div className="auth-layout">
        <motion.div
          className="auth-card panel rim"
          initial={{ opacity: 0, y: 26, scale: 0.97, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: ease.out }}
        >
          <span className="eyebrow">Create account</span>

          <h1 className="auth-title">
            <SplitText trigger="mount" delay={0.25}>
              Start talking it through
            </SplitText>
          </h1>

          <motion.p
            className="auth-sub"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: ease.out, delay: 0.55 }}
          >
            Free, no card. Upload a set of slides and see whether explaining them
            back does anything for you.
          </motion.p>

          <AuthMessage kind="error">{error}</AuthMessage>
          <AuthMessage kind="good">{notice}</AuthMessage>

          <motion.form
            onSubmit={handleSubmit}
            className="auth-form"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08, delayChildren: 0.45 } },
            }}
            initial="hidden"
            animate="show"
          >
            <AuthField
              label="Full name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={submitting}
            />

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
              minLength={8}
              autoComplete="new-password"
              hint="At least 8 characters."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
            />

            <AuthSubmit
              busy={submitting}
              idle="Create account"
              working="Creating account…"
            />
          </motion.form>

          <p className="auth-foot">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </motion.div>

        <AuthAside
          title="Nobody is awake at eleven to be talked at. That is the gap."
          lines={[
            `${PLAN_LIMITS.free} messages a day, free, no card`,
            'PDFs up to 25 MB — slides, briefs, past papers',
            'Export everything, or delete it, whenever',
          ]}
        />
      </div>
    </div>
  )
}

export default Signup
