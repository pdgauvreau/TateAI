import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

const sectionLinks = [
  { hash: '#features', label: 'Features' },
  { hash: '#how-it-works', label: 'How It Works' },
  { hash: '#research', label: 'Research' },
  { hash: '#use-cases', label: 'Use Cases' },
]

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close the mobile menu on navigation, otherwise it stays open over the new page.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const isHomePage = location.pathname === '/'
  const closeMenu = () => setMenuOpen(false)

  const handleSignOut = async () => {
    closeMenu()
    await signOut()
    navigate('/')
  }

  return (
    <motion.nav
      className={`navbar ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="navbar-container">
        <Link to="/" onClick={closeMenu}>
          <motion.div
            className="logo"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="logo-text">TATE</span>
            <span className="logo-ai">AI</span>
          </motion.div>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={`nav-toggle-bar ${menuOpen ? 'open' : ''}`} />
          <span className={`nav-toggle-bar ${menuOpen ? 'open' : ''}`} />
          <span className={`nav-toggle-bar ${menuOpen ? 'open' : ''}`} />
        </button>

        <div
          id="primary-navigation"
          className={`nav-links ${menuOpen ? 'open' : ''}`}
        >
          {sectionLinks.map(({ hash, label }) =>
            isHomePage ? (
              <a key={hash} href={hash} onClick={closeMenu}>
                {label}
              </a>
            ) : (
              <Link key={hash} to={`/${hash}`} onClick={closeMenu}>
                {label}
              </Link>
            )
          )}
          <Link to="/pricing" onClick={closeMenu}>
            Pricing
          </Link>

          {/* Duplicated inside the panel so the primary action is reachable on
              mobile, where the standalone button is hidden. */}
          <div className="nav-links-actions">
            {user ? (
              <>
                <Link to="/dashboard" onClick={closeMenu}>
                  Dashboard
                </Link>
                <button type="button" className="nav-signout" onClick={handleSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={closeMenu}>
                  Sign in
                </Link>
                <Link to="/signup" onClick={closeMenu}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <Link to="/dashboard" className="nav-action-link">
                Dashboard
              </Link>
              <motion.button
                className="cta-button"
                onClick={handleSignOut}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Sign Out
              </motion.button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-action-link">
                Sign in
              </Link>
              <Link to="/signup">
                <motion.button
                  className="cta-button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Get Started
                </motion.button>
              </Link>
            </>
          )}
        </div>
      </div>
    </motion.nav>
  )
}

export default Navbar
