import React from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import { CursorGlow, PageTransition, ScrollProgress } from './components/motion/Chrome'
import { AuthProvider } from './context/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Conversation from './pages/Conversation'
import Legal from './pages/Legal'
import NotFound from './pages/NotFound'
import Pricing from './components/Pricing'
import { ease } from './motion/tokens'
import './App.css'

/**
 * Route shell.
 *
 * `AnimatePresence mode="wait"` is keyed on the pathname, so a navigation plays
 * the outgoing page's exit before mounting the next one. Two details that are
 * easy to get wrong:
 *
 * - The key is the pathname, not the whole location. Keying on search or state
 *   would replay the whole transition when a query parameter changes, which
 *   happens on every Stripe return and every dismissed notice.
 * - Scroll is reset on exit completion rather than on mount, so the outgoing page
 *   is not visibly yanked to the top mid-animation.
 */
const AnimatedRoutes = () => {
  const location = useLocation()

  // The chat is a fixed-height application view; a marketing footer beneath it
  // would only ever be reachable by scrolling past the composer.
  const chromeless = location.pathname.startsWith('/chat/')

  return (
    <>
      <AnimatePresence
        mode="wait"
        initial={false}
        onExitComplete={() => window.scrollTo({ top: 0, behavior: 'instant' })}
      >
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <PageTransition>
                <Home />
              </PageTransition>
            }
          />
          <Route
            path="/pricing"
            element={
              <PageTransition>
                <Pricing />
              </PageTransition>
            }
          />
          <Route
            path="/login"
            element={
              <PageTransition>
                <Login />
              </PageTransition>
            }
          />
          <Route
            path="/signup"
            element={
              <PageTransition>
                <Signup />
              </PageTransition>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat/:id"
            element={
              <ProtectedRoute>
                <PageTransition>
                  <Conversation />
                </PageTransition>
              </ProtectedRoute>
            }
          />
          <Route
            path="/privacy"
            element={
              <PageTransition>
                <Legal kind="privacy" />
              </PageTransition>
            }
          />
          <Route
            path="/terms"
            element={
              <PageTransition>
                <Legal kind="terms" />
              </PageTransition>
            }
          />
          <Route
            path="*"
            element={
              <PageTransition>
                <NotFound />
              </PageTransition>
            }
          />
        </Routes>
      </AnimatePresence>

      {!chromeless && <Footer />}
    </>
  )
}

function App() {
  return (
    /* One place decides how the whole app treats a reduced-motion preference.
       "user" makes Framer skip transforms and opacity changes for those readers
       while still applying the end state, so nothing is left invisible — which is
       exactly what a per-component `if (reduced) return null` tends to cause. */
    <MotionConfig reducedMotion="user" transition={{ ease: ease.out }}>
      <AuthProvider>
        <Router>
          <div className="App">
            <ScrollProgress />
            <CursorGlow />
            <Navbar />
            <AnimatedRoutes />
          </div>
        </Router>
      </AuthProvider>
    </MotionConfig>
  )
}

export default App
