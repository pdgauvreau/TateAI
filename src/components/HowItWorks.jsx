import React from 'react'
import { motion } from 'framer-motion'
import './HowItWorks.css'

const HowItWorks = () => {
  const steps = [
    {
      label: 'UPLOAD',
      title: 'Upload Your Materials',
      description: 'Upload your class slides, assignments, practice exams, and study notes. TATE AI processes and understands your course content.',
    },
    {
      label: 'ANALYZE',
      title: 'AI Analysis',
      description: 'TATE AI analyzes your materials to identify key concepts, topics, and your current knowledge level. It builds a personalized learning profile.',
    },
    {
      label: 'TALK',
      title: 'Start Talking',
      description: 'Have natural conversations with TATE AI. Ask questions, explain concepts, discuss topics, and practice active recall through dialogue.',
    },
    {
      label: 'IMPROVE',
      title: 'Learn & Improve',
      description: 'TATE AI adapts to your learning style, identifies knowledge gaps, and helps you strengthen weak areas through targeted conversations.',
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
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
    <section id="how-it-works" className="how-it-works">
      <div className="how-it-works-container">
        <motion.div
          className="how-it-works-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="section-label">// HOW IT WORKS</div>
          <h2 className="how-it-works-title">
            Setup and Start Learning
          </h2>
          <p className="how-it-works-subtitle">
            A simple, powerful process designed to help you learn more effectively—upload, analyze, talk, improve.
          </p>
        </motion.div>

        <motion.div
          className="steps-container"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="step-card"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="step-label">{step.label}</div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-description">{step.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default HowItWorks

