import React from 'react'
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
              Revolutionizing artificial intelligence for the modern world.
            </p>
          </div>

          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="/#features">Features</a>
              <a href="/pricing">Pricing</a>
              <a href="/#how-it-works">How It Works</a>
            </div>
          </div>
        </motion.div>

        <div className="footer-bottom">
          <p>&copy; 2024 TATE AI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

