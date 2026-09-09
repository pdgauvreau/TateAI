import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import './Footer.css'

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <motion.div
          className="footer-content"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="logo-text">TATE</span>
              <span className="logo-ai">AI</span>
            </div>
            <p className="footer-tagline">
              Learn by talking. Upload your course materials and think them through
              out loud.
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <Link to="/#features">Features</Link>
              <Link to="/#how-it-works">How It Works</Link>
              <Link to="/pricing">Pricing</Link>
            </div>

            <div className="footer-column">
              <h4>Account</h4>
              <Link to="/signup">Create account</Link>
              <Link to="/login">Sign in</Link>
            </div>

            <div className="footer-column">
              <h4>Legal</h4>
              <Link to="/privacy">Privacy Policy</Link>
              <Link to="/terms">Terms of Service</Link>
              <a href="mailto:support@tateai.app">Contact</a>
            </div>
          </div>
        </motion.div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} TATE AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
