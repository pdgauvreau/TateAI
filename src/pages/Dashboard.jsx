import React, { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import DocumentUpload from '../components/DocumentUpload'
import DocumentList from '../components/DocumentList'
import ConversationPanel from '../components/ConversationPanel'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../lib/documents'
import { listConversations, getUsage } from '../lib/conversations'
import { limitForPlan } from '../../shared/plans'
import { exportAllData } from '../lib/exportData'
import { openBillingPortal } from '../lib/billing'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

const Dashboard = () => {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [used, setUsed] = useState(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [confirmSlow, setConfirmSlow] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const justPaid = searchParams.get('checkout') === 'success'

  useEffect(() => {
    if (!user) return
    let active = true
    let timer

    // Doubles as an end-to-end check that auth, RLS, and the profiles trigger
    // are all wired up: this only returns a row for the signed-in user.
    const load = () =>
      supabase
        .from('profiles')
        .select('full_name, email, plan, created_at, subscription_status, current_period_end')
        .eq('id', user.id)
        .single()

    // Returning from Stripe, the plan is changed by the webhook, not the redirect,
    // and the webhook can land a moment after the student does. Poll briefly
    // rather than showing them the old plan and implying the payment failed.
    const poll = async (attempt = 0) => {
      const { data, error } = await load()
      if (!active) return
      if (error) {
        setLoadError(error.message)
        return
      }
      setProfile(data)

      const upgraded = data.plan !== 'free'
      if (justPaid && !upgraded) {
        // Keep checking for about a minute, slowing down as it goes, then say so
        // plainly rather than leaving "confirming…" up indefinitely.
        if (attempt < 12) timer = setTimeout(() => poll(attempt + 1), attempt < 6 ? 2000 : 5000)
        else setConfirmSlow(true)
      }
    }

    poll()

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [user, justPaid])

  const handleManageBilling = async () => {
    setLoadError('')
    setOpeningPortal(true)
    const { error } = await openBillingPortal()
    // openBillingPortal navigates away on success; reaching here means it failed.
    setOpeningPortal(false)
    if (error) setLoadError(error)
  }

  const refreshDocuments = useCallback(async () => {
    const { data, error } = await listDocuments()
    if (error) setLoadError(error.message)
    else setDocuments(data ?? [])
    setDocumentsLoading(false)
  }, [])

  const refreshConversations = useCallback(async () => {
    const { data, error } = await listConversations()
    if (error) setLoadError(error.message)
    else setConversations(data ?? [])
    setConversationsLoading(false)
  }, [])

  useEffect(() => {
    if (!user) return
    refreshDocuments()
    refreshConversations()
    getUsage(user.id).then((r) => {
      if (!r.error) setUsed(r.used)
    })
  }, [user, refreshDocuments, refreshConversations])

  const handleExport = async () => {
    setLoadError('')
    setExporting(true)
    const { error } = await exportAllData()
    setExporting(false)
    if (error) setLoadError(`Export failed: ${error}`)
  }

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
            {profile && used !== null && limitForPlan(profile.plan) !== null && (
              <span className="dashboard-usage">
                {' '}
                {used} of {limitForPlan(profile.plan)} messages used in the last 24 hours.
              </span>
            )}
          </p>
          {profile?.current_period_end && profile.plan !== 'free' && (
            <p className="dashboard-renewal">
              {profile.subscription_status === 'past_due'
                ? 'Your last payment failed — update your card to keep your plan.'
                : `Renews ${new Date(profile.current_period_end).toLocaleDateString(undefined, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}.`}
            </p>
          )}
          <div className="dashboard-actions">
            {profile?.subscription_status ? (
              <button
                type="button"
                className="dashboard-export"
                onClick={handleManageBilling}
                disabled={openingPortal}
              >
                {openingPortal ? 'Opening billing…' : 'Manage billing'}
              </button>
            ) : (
              <Link to="/pricing" className="dashboard-export dashboard-upgrade">
                Upgrade
              </Link>
            )}
            <button
              type="button"
              className="dashboard-export"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? 'Preparing export…' : 'Export my data'}
            </button>
          </div>
        </motion.header>

        {justPaid && (
          <div className="dashboard-notice">
            {profile && profile.plan !== 'free' ? (
              <>
                You&apos;re on the {profile.plan} plan — thanks for subscribing.{' '}
                <button type="button" className="notice-dismiss" onClick={() => setSearchParams({})}>
                  Dismiss
                </button>
              </>
            ) : confirmSlow ? (
              <>
                Your payment went through, but confirming your plan is taking longer than usual.
                You won&apos;t be charged again — refresh in a few minutes, and if your plan still
                hasn&apos;t changed, email{' '}
                <a href="mailto:support@tateai.app">support@tateai.app</a>.
              </>
            ) : (
              'Payment received — confirming your plan with Stripe…'
            )}
          </div>
        )}

        {loadError && <div className="dashboard-error">{loadError}</div>}

        <motion.div
          className="dashboard-grid"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <section className="dashboard-panel">
            <h2 className="panel-title">Your materials</h2>
            <DocumentUpload onUploaded={refreshDocuments} />
            <DocumentList
              documents={documents}
              loading={documentsLoading}
              onChanged={refreshDocuments}
            />
          </section>

          <section className="dashboard-panel">
            <h2 className="panel-title">Your conversations</h2>
            <ConversationPanel
              conversations={conversations}
              documents={documents}
              loading={conversationsLoading}
              onChanged={refreshConversations}
            />
          </section>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
