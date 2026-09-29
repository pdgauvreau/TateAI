import React, { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import DotBackground from '../components/DotBackground'
import DocumentUpload from '../components/DocumentUpload'
import DocumentList from '../components/DocumentList'
import ConversationPanel from '../components/ConversationPanel'
import CourseBar from '../components/CourseBar'
import AssignmentsPanel from '../components/AssignmentsPanel'
import StudyPanel from '../components/StudyPanel'
import SplitText from '../components/motion/SplitText'
import { Counter, ProgressRing } from '../components/motion/Interactive'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../lib/documents'
import { listConversations, getUsage } from '../lib/conversations'
import { listCourses } from '../lib/courses'
import { groupAssignments, listAssignments } from '../lib/assignments'
import { listStudyItems } from '../lib/study'
import { budgetForPlan } from '../../shared/plans'
import { exportAllData } from '../lib/exportData'
import { openBillingPortal } from '../lib/billing'
import { ease, spring } from '../motion/tokens'
import { supabase } from '../lib/supabase'
import './Dashboard.css'

const COURSE_PREF_KEY = 'tateai:course'

const panelMotion = {
  variants: {
    hidden: { opacity: 0, y: 26, filter: 'blur(8px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)' },
  },
  transition: { duration: 0.65, ease: ease.out },
}

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
  const [usage, setUsage] = useState(null)
  const [openingPortal, setOpeningPortal] = useState(false)
  const [confirmSlow, setConfirmSlow] = useState(false)
  const [courses, setCourses] = useState([])
  // The course filter is remembered per browser, so the dashboard reopens on
  // the class the student was last working on.
  const [courseId, setCourseId] = useState(() => {
    try {
      return localStorage.getItem(COURSE_PREF_KEY) || null
    } catch {
      return null
    }
  })
  const [assignments, setAssignments] = useState([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(true)
  const [studyItems, setStudyItems] = useState([])
  const [studyLoading, setStudyLoading] = useState(true)
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

  const refreshCourses = useCallback(async () => {
    const { data, error } = await listCourses()
    if (error) {
      setLoadError(error.message)
      return
    }
    setCourses(data ?? [])
    // A remembered course that has since been deleted falls back to "All".
    setCourseId((current) => (current && !(data ?? []).some((c) => c.id === current) ? null : current))
  }, [])

  const refreshAssignments = useCallback(async () => {
    const { data, error } = await listAssignments()
    if (error) setLoadError(error.message)
    else setAssignments(data ?? [])
    setAssignmentsLoading(false)
  }, [])

  const refreshStudy = useCallback(async () => {
    const { items, error } = await listStudyItems()
    if (error) setLoadError(error)
    else setStudyItems(items)
    setStudyLoading(false)
  }, [])

  useEffect(() => {
    try {
      if (courseId) localStorage.setItem(COURSE_PREF_KEY, courseId)
      else localStorage.removeItem(COURSE_PREF_KEY)
    } catch {
      /* private window — the filter still works for this visit */
    }
  }, [courseId])

  // Changing a course's name or colour, or deleting it, touches every panel.
  const refreshAfterCourseChange = useCallback(async () => {
    await refreshCourses()
    refreshDocuments()
    refreshConversations()
    refreshAssignments()
    refreshStudy()
  }, [refreshCourses, refreshDocuments, refreshConversations, refreshAssignments, refreshStudy])

  useEffect(() => {
    if (!user) return
    refreshCourses()
    refreshAssignments()
    refreshStudy()
    refreshDocuments()
    refreshConversations()
    getUsage().then((r) => {
      if (!r.error) setUsage(r)
    })
  }, [user, refreshCourses, refreshAssignments, refreshStudy, refreshDocuments, refreshConversations])

  const handleExport = async () => {
    setLoadError('')
    setExporting(true)
    const { error } = await exportAllData()
    setExporting(false)
    if (error) setLoadError(`Export failed: ${error}`)
  }

  const displayName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'there'
  const budget = profile ? budgetForPlan(profile.plan) : null
  const hasMeter = Boolean(profile && usage && budget)
  // Shown as a share of the allowance rather than dollars: the student is buying
  // study time, and what they need at a glance is how much is left.
  const monthShare = hasMeter ? Math.min(1, usage.monthUsed / budget.monthly) : 0
  const dayCapped = hasMeter && usage.dayUsed >= budget.daily
  const readyDocs = documents.filter((d) => d.status === 'ready').length

  // With a course picked, materials and conversations show that course's own.
  // The generators and the planner filter for themselves, since they also
  // offer unfiled documents to draw from.
  const inCourse = (row) => !courseId || row.course_id === courseId
  const shownDocuments = documents.filter(inCourse)
  const shownConversations = conversations.filter(inCourse)
  const dueSoon = (() => {
    const g = groupAssignments(assignments.filter(inCourse))
    return g.overdue.length + g.today.length + g.week.length
  })()

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
                    {dueSoon > 0 && (
                      <>
                        {' · '}
                        <span className="dash-due">{dueSoon} due this week</span>
                      </>
                    )}
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
                  value={monthShare}
                  size={84}
                  label={`${Math.round(monthShare * 100)}% of this month's study allowance used`}
                >
                  <Counter to={Math.round(monthShare * 100)} suffix="%" />
                </ProgressRing>
                <div className="meter-copy">
                  <span className="meter-label">Study allowance</span>
                  <span className="meter-value">
                    <Counter to={Math.round(monthShare * 100)} suffix="%" /> used
                  </span>
                  <span className="meter-note">
                    {dayCapped ? 'Today’s share used up · more frees up within 24 hours' : 'Rolling 30 days'}
                  </span>
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

        <CourseBar
          courses={courses}
          selectedId={courseId}
          onSelect={setCourseId}
          onChanged={refreshAfterCourseChange}
        />

        <motion.div
          className="dash-grid"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
          }}
          initial="hidden"
          animate="show"
        >
          <motion.section className="dash-panel panel rim" {...panelMotion}>
            <header className="panel-head">
              <h2 className="panel-title">Due soon</h2>
              <span className="panel-count">{dueSoon}</span>
            </header>
            <AssignmentsPanel
              assignments={assignments}
              courses={courses}
              documents={documents}
              courseId={courseId}
              loading={assignmentsLoading}
              onChanged={refreshAssignments}
            />
          </motion.section>

          <motion.section className="dash-panel panel rim" {...panelMotion}>
            <header className="panel-head">
              <h2 className="panel-title">Study tools</h2>
              <span className="panel-count">
                {(courseId ? studyItems.filter(inCourse) : studyItems).length}
              </span>
            </header>
            <StudyPanel
              items={studyItems}
              documents={documents}
              courseId={courseId}
              loading={studyLoading}
              onChanged={refreshStudy}
            />
          </motion.section>

          <motion.section className="dash-panel panel rim" {...panelMotion}>
            <header className="panel-head">
              <h2 className="panel-title">Your materials</h2>
              <span className="panel-count">{shownDocuments.length}</span>
            </header>
            <DocumentUpload onUploaded={refreshDocuments} courseId={courseId} />
            <DocumentList
              documents={shownDocuments}
              courses={courses}
              loading={documentsLoading}
              onChanged={refreshDocuments}
            />
          </motion.section>

          <motion.section className="dash-panel panel rim" {...panelMotion}>
            <header className="panel-head">
              <h2 className="panel-title">Your conversations</h2>
              <span className="panel-count">{shownConversations.length}</span>
            </header>
            <ConversationPanel
              conversations={shownConversations}
              documents={documents.filter((d) => !courseId || d.course_id === courseId || !d.course_id)}
              courseId={courseId}
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
