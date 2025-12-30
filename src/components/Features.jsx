import React from 'react'
import { motion } from 'framer-motion'
import './Features.css'

const Features = () => {
  const features = [
    {
      label: 'Upload Materials | Process Content',
      title: 'Upload Your Materials',
      description: 'Upload class slides, assignments, practice exams, and notes. TATE AI analyzes your content to understand what you\'re learning.'
    },
    {
      label: 'Talk & Learn | Active Recall',
      title: 'Conversational Learning',
      description: 'Have natural conversations about your coursework. Ask questions, explain concepts, and discuss topics just like talking to a study partner.'
    },
    {
      label: 'Track Progress | Identify Gaps',
      title: 'Personalized Assessment',
      description: 'TATE AI tracks your knowledge level and identifies gaps. Get targeted help on topics you need to strengthen.'
    },
    {
      label: 'Practice Out Loud | Remember More',
      title: 'Active Recall Practice',
      description: 'Practice explaining concepts out loud. Research shows verbalizing information significantly improves memory retention.'
    },
    {
      label: 'Monitor Learning | Adapt Pace',
      title: 'Progress Tracking',
      description: 'See your learning progress over time. TATE AI adapts to your pace and helps you review at optimal intervals.'
    },
    {
      label: 'Your Data | Your Privacy',
      title: 'Private & Secure',
      description: 'Your study materials and conversations are completely private. Your data stays yours.'
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
    <section id="features" className="features">
      <div className="features-container">
        <motion.div
          className="features-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="section-label">// FEATURES</div>
          <h2 className="features-title">
            The Core Study Tools
          </h2>
          <p className="features-subtitle">
            Upload materials, have conversations, track progress—everything you need to master your coursework.
          </p>
        </motion.div>

        <motion.div
          className="features-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="feature-label">{feature.label}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default Features

