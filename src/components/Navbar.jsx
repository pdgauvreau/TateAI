import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useScrolled } from '../motion/hooks'
import { ease, spring } from '../motion/tokens'
import { Magnetic } from './motion/Interactive'
import ThemeToggle from './motion/ThemeToggle'
import './Navbar.css'

const sectionLinks = [
  { hash: '#features', label: 'Features' },
  { hash: '#how-it-works', label: 'How It Works' },
  { hash: '#research', label: 'Research' },
  { hash: '#use-cases', label: 'Use Cases' },
]

const Navbar = () => {
  const scrolled = useScrolled(24)
  const [menuOpen, setMenuOpen] = useState(false)
  const [hovered, setHovered] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // Close on navigation, otherwise the panel stays open over the new page.
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // The overlay covers the document; leaving the page scrollable behind it means
  // the reader can scroll content they cannot see.
  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const isHomePage = location.pathname === '/'
  const closeMenu = () => setMenuOpen(false)

  const handleSignOut = async () => {
    closeMenu()
    await signOut()
    navigate('/')
  }

  const navItems = [
    ...sectionLinks.map(({ hash, label }) => ({
      key: hash,
      label,
      to: isHomePage ? hash : `/${hash}`,
      hashOnly: isHomePage,
    })),
    { key: '/pricing', label: 'Pricing', to: '/pricing', hashOnly: false },
  ]

  return (
    <>
      <motion.nav
        className={`nav ${scrolled ? 'is-scrolled' : ''}`}
        initial={{ y: -84, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: ease.out, delay: 0.1 }}
      >
        {/* Separate from the bar so the blur can fade in on scroll without the
            content inheriting the opacity change. */}
        <motion.div
          className="nav-veil"
          animate={{ opacity: scrolled ? 1 : 0 }}
          transition={{ duration: 0.4, ease: ease.out }}
          aria-hidden="true"
        />

        <div className="nav-inner shell">
          <Link to="/" className="brand" onClick={closeMenu} aria-label="TATE AI home">
            <motion.span
              className="brand-mark"
              whileHover={{ rotate: 90, scale: 1.08 }}
              transition={spring.pop}
              aria-hidden="true"
            >
              {/* Two arcs facing each other: the conversation the product is
                  about, and the only literal illustration in the identity. */}
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M4 9.5a5.5 5.5 0 0 1 5.5-5.5h1" />
                <path d="M20 14.5a5.5 5.5 0 0 1-5.5 5.5h-1" />
                <circle cx="8" cy="16" r="2.4" />
                <circle cx="16" cy="8" r="2.4" />
              </svg>
            </motion.span>
            <span className="brand-word">
              TATE<span className="brand-ai">AI</span>
            </span>
          </Link>

          <div className="nav-links" onMouseLeave={() => setHovered(null)}>
            {navItems.map((item) => {
              const active = location.pathname === item.key
              const Tag = item.hashOnly ? 'a' : Link
              const linkProps = item.hashOnly ? { href: item.to } : { to: item.to }

              return (
                <Tag
                  key={item.key}
                  className={`nav-link ${active ? 'is-active' : ''}`}
                  onMouseEnter={() => setHovered(item.key)}
                  onClick={closeMenu}
                  {...linkProps}
                >
                  {/* One pill, moved between links by the layout animation rather
                      than a pill per link fading in and out. That is what makes
                      it travel instead of blink. */}
                  <AnimatePresence>
                    {hovered === item.key && (
                      <motion.span
                        className="nav-pill"
                        layoutId="nav-pill"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={spring.glide}
                        aria-hidden="true"
                      />
                    )}
                  </AnimatePresence>
                  <span className="nav-link-text">{item.label}</span>
                  {active && (
                    <motion.span
                      className="nav-underline"
                      layoutId="nav-underline"
                      transition={spring.glide}
                      aria-hidden="true"
                    />
                  )}
                </Tag>
              )
            })}
          </div>

          {/* Outside .nav-actions on purpose: that cluster collapses into the
              mobile sheet, and the theme switch should stay reachable without
              opening a menu. */}
          <ThemeToggle className="nav-theme" />

          <div className="nav-actions">
            {user ? (
              <>
                <Link to="/dashboard" className="nav-quiet">
                  Dashboard
                </Link>
                <Magnetic>
                  <motion.button
                    type="button"
                    className="btn btn-ghost nav-cta"
                    onClick={handleSignOut}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={spring.snap}
                  >
                    Sign out
                  </motion.button>
                </Magnetic>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-quiet">
                  Sign in
                </Link>
                <Magnetic>
                  <Link to="/signup">
                    <motion.span
                      className="btn btn-primary nav-cta"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      transition={spring.snap}
                    >
                      Get started
                      <Arrow />
                    </motion.span>
                  </Link>
                </Magnetic>
              </>
            )}
          </div>

          <button
            type="button"
            className="nav-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {/* Two bars rotating into an X, with the middle collapsing. Animated
                by Framer rather than CSS classes so the rotation and the
                translate share one spring and stay in step. */}
            <motion.span
              className="burger-bar"
              animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              transition={spring.snap}
            />
            <motion.span
              className="burger-bar"
              animate={menuOpen ? { opacity: 0, scaleX: 0.3 } : { opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.18 }}
            />
            <motion.span
              className="burger-bar"
              animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
              transition={spring.snap}
            />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-nav"
            className="nav-sheet"
            initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
            exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.5, ease: ease.inOut }}
          >
            {/* Wipes down as a sheet, then the links arrive in sequence — the
                panel lands first so the links have somewhere to land into. */}
            <motion.div
              className="nav-sheet-inner"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.055, delayChildren: 0.18 } },
              }}
              initial="hidden"
              animate="show"
            >
              {navItems.map((item) => {
                const Tag = item.hashOnly ? 'a' : Link
                const linkProps = item.hashOnly ? { href: item.to } : { to: item.to }
                return (
                  <motion.div
                    key={item.key}
                    variants={{
                      hidden: { opacity: 0, y: 26, filter: 'blur(6px)' },
                      show: { opacity: 1, y: 0, filter: 'blur(0px)' },
                    }}
                    transition={{ duration: 0.5, ease: ease.out }}
                  >
                    <Tag className="sheet-link" onClick={closeMenu} {...linkProps}>
                      {item.label}
                      <Arrow />
                    </Tag>
                  </motion.div>
                )
              })}

              <motion.div
                className="sheet-foot"
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.5, ease: ease.out }}
              >
                {user ? (
                  <>
                    <Link to="/dashboard" className="btn btn-ghost" onClick={closeMenu}>
                      Dashboard
                    </Link>
                    <button type="button" className="btn btn-primary" onClick={handleSignOut}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="btn btn-ghost" onClick={closeMenu}>
                      Sign in
                    </Link>
                    <Link to="/signup" className="btn btn-primary" onClick={closeMenu}>
                      Get started
                    </Link>
                  </>
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const Arrow = () => (
  <svg
    className="arrow"
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 8h9M8.5 4l4 4-4 4" />
  </svg>
)

export default Navbar
