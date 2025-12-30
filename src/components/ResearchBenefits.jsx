import React from 'react'
import { motion } from 'framer-motion'
import './ResearchBenefits.css'

const ResearchBenefits = () => {
  const benefits = [
    {
      label: 'Production Effect | Speak to Remember',
      title: 'The Production Effect',
      description: 'Research shows that speaking information aloud (the "production effect") significantly improves memory retention compared to silent reading. Talking activates multiple brain regions, creating stronger memory traces.',
      stat: '40% Better Retention',
      source: 'MacLeod et al., 2010'
    },
    {
      label: 'Active Recall | Explain to Strengthen',
      title: 'Active Recall Through Dialogue',
      description: 'Explaining concepts to someone else forces you to retrieve information from memory, strengthening neural pathways. This active recall is one of the most effective learning techniques known to cognitive science.',
      stat: '2x More Effective',
      source: 'Karpicke & Blunt, 2011'
    },
    {
      label: 'Metacognition | Know What You Know',
      title: 'Metacognitive Awareness',
      description: 'When you explain concepts out loud, you quickly identify what you truly understand versus what you only think you know. This metacognitive awareness helps you focus your study time more efficiently.',
      stat: 'Better Self-Assessment',
      source: 'Dunlosky & Rawson, 2012'
    },
    {
      label: 'Dual Coding | Visual + Verbal',
      title: 'Dual Coding Theory',
      description: 'Combining verbal explanations with visual materials (like your slides) engages both verbal and visual processing systems, creating richer, more durable memories.',
      stat: 'Enhanced Encoding',
      source: 'Paivio, 1986'
    },
    {
      label: 'Spaced Repetition | Review Optimally',
      title: 'Spaced Repetition',
      description: 'TATE AI tracks what you\'ve discussed and when, helping you review concepts at optimal intervals. Spaced repetition is proven to dramatically improve long-term retention.',
      stat: '3x Long-term Retention',
      source: 'Cepeda et al., 2006'
    },
    {
      label: 'Cognitive Load | Learn Naturally',
      title: 'Reduced Cognitive Load',
      description: 'Having a conversation about your studies feels natural and engaging, reducing the mental effort required compared to traditional study methods. This makes learning more sustainable.',
      stat: 'Less Mental Fatigue',
      source: 'Sweller, 1988'
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
    <section id="research" className="research-benefits">
      <div className="research-container">
        <motion.div
          className="research-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="section-label">// RESEARCH</div>
          <h2 className="research-title">
            Why Talking Helps You Learn
          </h2>
          <p className="research-subtitle">
            Backed by decades of cognitive science research, conversational learning is one of the most effective ways to study.
          </p>
        </motion.div>

        <motion.div
          className="benefits-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={index}
              className="benefit-card"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="benefit-label">{benefit.label}</div>
              <div className="benefit-stat">{benefit.stat}</div>
              <h3 className="benefit-title">{benefit.title}</h3>
              <p className="benefit-description">{benefit.description}</p>
              <div className="benefit-source">{benefit.source}</div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className="research-summary"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="summary-box">
            <h3 className="summary-title">The Science of Learning</h3>
            <p className="summary-text">
              Decades of research in cognitive psychology consistently show that active, verbal learning methods 
              outperform passive study techniques. When you talk about what you're learning, you're not just reviewing—you're 
              actively constructing knowledge, making connections, and strengthening memories. TATE AI brings this powerful 
              learning method to your fingertips, making it easier than ever to study effectively.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default ResearchBenefits

