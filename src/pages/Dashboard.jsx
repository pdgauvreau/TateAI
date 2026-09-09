import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

const Dashboard = () => {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!user) return
    let active = true

    // Doubles as an end-to-end check that auth, RLS, and the profiles trigger
    // are all wired up: this only returns a row for the signed-in user.
    supabase
      .from('profiles')
      .select('full_name, email, plan, created_at')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setLoadError(error.message)
        else setProfile(data)
      })

    return () => {
      active = false
    }
  }, [user])

  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'there'

  return (
    <div className="dashboard-page">
      <DotBackground />
      <div className="dashboard-container">
        <motion.header
          className="dashboard-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="section-label">// DASHBOARD</div>
          <h1 className="dashboard-title">Welcome back, {displayName}</h1>
          <p className="dashboard-subtitle">
            {profile ? `You're on the ${profile.plan} plan.` : 'Loading your profile…'}
          </p>
        </motion.header>

        {loadError && <div className="dashboard-error">Could not load your profile: {loadError}</div>}

        <motion.div
          className="dashboard-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <section className="dashboard-panel">
            <h2 className="panel-title">Your materials</h2>
            <p className="panel-empty">
              No documents yet. Uploading slides, assignments, and practice exams is the
              next milestone.
            </p>
            <button className="panel-button" type="button" disabled>
              Upload materials
            </button>
          </section>

          <section className="dashboard-panel">
            <h2 className="panel-title">Your conversations</h2>
            <p className="panel-empty">
              No conversations yet. Once your materials are uploaded, you&apos;ll be able to
              talk through them here.
            </p>
            <button className="panel-button" type="button" disabled>
              Start a conversation
            </button>
          </section>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
