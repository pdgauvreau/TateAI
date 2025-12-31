import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import './Navbar.css'

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isHomePage = location.pathname === '/'

  return (
    <motion.nav
      className={`navbar ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="navbar-container">
        <Link to="/">
          <motion.div
            className="logo"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="logo-text">TATE</span>
            <span className="logo-ai">AI</span>
          </motion.div>
        </Link>
        
        <div className="nav-links">
          {isHomePage ? (
            <>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#research">Research</a>
              <a href="#use-cases">Use Cases</a>
            </>
          ) : (
            <>
              <Link to="/#features">Features</Link>
              <Link to="/#how-it-works">How It Works</Link>
              <Link to="/#research">Research</Link>
              <Link to="/#use-cases">Use Cases</Link>
            </>
          )}
          <Link to="/pricing">Pricing</Link>
        </div>

        <Link to="/pricing">
          <motion.button
            className="cta-button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Get Started
          </motion.button>
        </Link>
      </div>
    </motion.nav>
  )
}

export default Navbar

