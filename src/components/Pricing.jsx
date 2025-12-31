import React, { useEffect } from 'react'
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
      price: '$9',
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
      price: '$19',
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
                <motion.button
                  className={`plan-button ${plan.popular ? 'button-primary' : 'button-secondary'}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {plan.name === 'Institution' ? 'Contact Sales' : 'Get Started'}
                </motion.button>
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
              <h3 className="faq-question">Can I change plans later?</h3>
              <p className="faq-answer">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">Is there a free trial?</h3>
              <p className="faq-answer">Yes, all plans come with a 14-day free trial. No credit card required.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">What happens to my data if I cancel?</h3>
              <p className="faq-answer">Your data is yours. You can export all your conversations and materials before canceling.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-question">Do you offer student discounts?</h3>
              <p className="faq-answer">Yes, students with a valid .edu email address get 20% off any plan.</p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}

export default Pricing

