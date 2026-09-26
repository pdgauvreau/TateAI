import React, { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import DotBackground from '../components/DotBackground'
import DocumentUpload from '../components/DocumentUpload'
import DocumentList from '../components/DocumentList'
import ConversationPanel from '../components/ConversationPanel'
import SplitText from '../components/motion/SplitText'
import { Counter, ProgressRing } from '../components/motion/Interactive'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../lib/documents'
import { listConversations, getUsage } from '../lib/conversations'
import { limitForPlan } from '../../shared/plans'
import { exportAllData } from '../lib/exportData'
import { openBillingPortal } from '../lib/billing'
import { ease, spring } from '../motion/tokens'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

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
        .select('full_name, email, plan, created_at, subscription_status, current_period_end, cancel_at')
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
  const limit = profile ? limitForPlan(profile.plan) : null
  const hasMeter = profile && used !== null && limit !== null
  const readyDocs = documents.filter((d) => d.status === 'ready').length

  return (
    <div className="page dash">
      <DotBackground variant="bare" />

      <div className="shell">
        <motion.header
          className="dash-head"
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: ease.out }}
        >
          <div className="dash-greeting">
            <span className="eyebrow">Dashboard</span>
            <h1 className="dash-title">
              <SplitText trigger="mount" by="word" delay={0.2}>
                {`Welcome back, ${displayName}`}
              </SplitText>
            </h1>

            {/* The plan badge only appears once the profile has loaded, rather than
                showing a placeholder that then changes under the reader. */}
            <AnimatePresence mode="wait">
              {profile ? (
                <motion.div
                  key="plan"
                  className="dash-planline"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: ease.out }}
                >
                  <span className={`plan-badge is-${profile.plan}`}>{profile.plan}</span>
                  <span className="dash-planmeta">
                    {readyDocs > 0
                      ? `${readyDocs} document${readyDocs === 1 ? '' : 's'} ready`
                      : 'No documents ready yet'}
                    {' · '}
                    {conversations.length} conversation
                    {conversations.length === 1 ? '' : 's'}
                  </span>
                </motion.div>
              ) : (
                <motion.div key="skel" className="skeleton dash-skel" exit={{ opacity: 0 }} />
              )}
            </AnimatePresence>

            {profile?.current_period_end && profile.plan !== 'free' && (
              <motion.p
                className="dash-renewal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                {profile.subscription_status === 'past_due'
                  ? 'Your last payment failed — update your card to keep your plan.'
                  : profile.cancel_at
                    ? `Cancelled — your ${profile.plan} plan stays active until ${formatDate(
                        profile.cancel_at
                      )}. You won’t be charged again.`
                    : `Renews ${formatDate(profile.current_period_end)}.`}
              </motion.p>
            )}

            <div className="dash-actions">
              {/* Paid and still active: manage it. Free, or a plan that has ended:
                  offer to subscribe (checkout accepts lapsed customers). */}
              {profile?.subscription_status && profile.plan !== 'free' ? (
                <motion.button
                  type="button"
                  className="btn btn-quiet"
                  onClick={handleManageBilling}
                  disabled={openingPortal}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={spring.snap}
                >
                  {openingPortal ? 'Opening billing…' : 'Manage billing'}
                </motion.button>
              ) : (
                <Link to="/pricing">
                  <motion.span
                    className="btn btn-quiet is-upgrade"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    transition={spring.snap}
                  >
                    Upgrade
                  </motion.span>
                </Link>
              )}

              <motion.button
                type="button"
                className="btn btn-quiet"
                onClick={handleExport}
                disabled={exporting}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.snap}
              >
                {exporting ? 'Preparing export…' : 'Export my data'}
              </motion.button>
            </div>
          </div>

          {/* The allowance meter. A ring rather than a sentence, because the thing
              worth knowing at a glance is how much is left, not the two numbers. */}
          <AnimatePresence>
            {hasMeter && (
              <motion.div
                className="dash-meter panel rim"
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ duration: 0.6, ease: ease.out, delay: 0.25 }}
              >
                <ProgressRing
                  value={used / limit}
                  size={84}
                  label={`${used} of ${limit} messages used today`}
                >
                  <Counter to={Math.round((used / limit) * 100)} suffix="%" />
                </ProgressRing>
                <div className="meter-copy">
                  <span className="meter-label">Today’s messages</span>
                  <span className="meter-value">
                    <Counter to={used} /> / {limit}
                  </span>
                  <span className="meter-note">Rolling 24 hours</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.header>

        <AnimatePresence>
          {justPaid && (
            <motion.div
              className="note note-good dash-note"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.4, ease: ease.out }}
            >
              {profile && profile.plan !== 'free' ? (
                <>
                  You’re on the {profile.plan} plan — thanks for subscribing.{' '}
                  <button
                    type="button"
                    className="note-dismiss"
                    onClick={() => setSearchParams({})}
                  >
                    Dismiss
                  </button>
                </>
              ) : confirmSlow ? (
                <>
                  Your payment went through, but confirming your plan is taking longer
                  than usual. You won’t be charged again — refresh in a few minutes,
                  and if your plan still hasn’t changed, email{' '}
                  <a href="mailto:support@tateai.app">support@tateai.app</a>.
                </>
              ) : (
                <span className="dash-confirming">
                  <span className="auth-spinner" aria-hidden="true" />
                  Payment received — confirming your plan with Stripe…
                </span>
              )}
            </motion.div>
          )}

          {loadError && (
            <motion.div
              className="note note-error dash-note"
              role="alert"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.4, ease: ease.out }}
            >
              {loadError}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="dash-grid"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
          }}
          initial="hidden"
          animate="show"
        >
          <motion.section
            className="dash-panel panel rim"
            variants={{
              hidden: { opacity: 0, y: 26, filter: 'blur(8px)' },
              show: { opacity: 1, y: 0, filter: 'blur(0px)' },
            }}
            transition={{ duration: 0.65, ease: ease.out }}
          >
            <header className="panel-head">
              <h2 className="panel-title">Your materials</h2>
              <span className="panel-count">{documents.length}</span>
            </header>
            <DocumentUpload onUploaded={refreshDocuments} />
            <DocumentList
              documents={documents}
              loading={documentsLoading}
              onChanged={refreshDocuments}
            />
          </motion.section>

          <motion.section
            className="dash-panel panel rim"
            variants={{
              hidden: { opacity: 0, y: 26, filter: 'blur(8px)' },
              show: { opacity: 1, y: 0, filter: 'blur(0px)' },
            }}
            transition={{ duration: 0.65, ease: ease.out }}
          >
            <header className="panel-head">
              <h2 className="panel-title">Your conversations</h2>
              <span className="panel-count">{conversations.length}</span>
            </header>
            <ConversationPanel
              conversations={conversations}
              documents={documents}
              loading={conversationsLoading}
              onChanged={refreshConversations}
            />
          </motion.section>
        </motion.div>
      </div>
    </div>
  )
}

export default Dashboard
