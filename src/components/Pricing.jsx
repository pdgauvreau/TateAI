import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import DotBackground from './DotBackground'
import './Pricing.css'

const Pricing = () => {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const plans = [
    {
      name: 'Student',
      price: '$18',
      period: '/month',
      description: 'Perfect for individual students looking to improve their study habits',
      features: [
        'Upload up to 50 documents per month',
        'Unlimited conversations',
        'Progress tracking',
        'Basic AI analysis',
        'Email support'
      ],
      popular: false
    },
    {
      name: 'Pro',
      price: '$26',
      period: '/month',
      description: 'For serious students who want advanced features and priority support',
      features: [
        'Unlimited document uploads',
        'Unlimited conversations',
        'Advanced progress analytics',
        'Deep AI analysis & insights',
        'Priority support',
        'Custom study plans',
        'Export study reports'
      ],
      popular: true
    },
    {
      name: 'Institution',
      price: 'Custom',
      period: '',
      description: 'Tailored solutions for schools, universities, and educational institutions',
      features: [
        'Bulk student accounts',
        'Admin dashboard',
        'Usage analytics',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantees',
        'Training & onboarding'
      ],
      popular: false
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6
      }
    }
  }

  return (
    <div className="pricing-page">
      <DotBackground />
      <section className="pricing-hero">
        <div className="pricing-hero-content">
          <motion.div
            className="pricing-label"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            // PRICING
          </motion.div>
          <motion.h1
            className="pricing-title"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Simple, Transparent Pricing
          </motion.h1>
          <motion.p
            className="pricing-subtitle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Choose the plan that fits your learning needs. All plans include our core conversational learning features.
          </motion.p>
          <motion.p
            className="pricing-notice"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            TATE AI is in early access. Plans are not purchasable yet — creating an account is
            free, and these prices are what we intend to charge when billing opens.
          </motion.p>
        </div>
      </section>

      <section className="pricing-plans">
        <div className="pricing-container">
          <motion.div
            className="plans-grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                className={`pricing-card ${plan.popular ? 'popular' : ''}`}
                variants={itemVariants}
                whileHover={{ y: -5 }}
                transition={{ duration: 0.3 }}
              >
                {plan.popular && (
                  <div className="popular-badge">Most Popular</div>
                )}
                <div className="plan-label">{plan.name}</div>
                <div className="plan-price">
                  <span className="price-amount">{plan.price}</span>
                  {plan.period && <span className="price-period">{plan.period}</span>}
                </div>
                <p className="plan-description">{plan.description}</p>
                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      <span className="feature-check">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.name === 'Institution' ? (
                  <motion.a
                    href="mailto:sales@tateai.app?subject=Institution%20plan%20enquiry"
                    className={`plan-button ${plan.popular ? 'button-primary' : 'button-secondary'}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Contact Sales
                  </motion.a>
                ) : (
                  <Link to="/signup" className="plan-button-link">
                    <motion.button
                      className={`plan-button ${plan.popular ? 'button-primary' : 'button-secondary'}`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Get Started
                    </motion.button>
                  </Link>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="pricing-faq">
        <div className="pricing-container">
          <motion.div
            className="faq-header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="section-label">// FAQ</div>
            <h2 className="faq-title">Frequently Asked Questions</h2>
          </motion.div>

          <motion.div
            className="faq-list"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="faq-item">
              <h3 className="faq-question">What does it cost right now?</h3>
              <p className="faq-answer">Nothing. TATE AI is in early access and billing is not switched on yet. We will tell you well before that changes.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">What can it read?</h3>
              <p className="faq-answer">PDFs, up to 25 MB each — lecture slides, assignment prompts, and practice exams. Scanned documents with no selectable text cannot be read yet.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">Can I get my data out?</h3>
              <p className="faq-answer">Yes. Export everything we hold — your profile, documents, and full conversation history — from your dashboard at any time.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">Will it do my homework?</h3>
              <p className="faq-answer">No, by design. It asks questions and gives hints rather than finished answers. You are responsible for following your institution's rules on AI use.</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Pricing

