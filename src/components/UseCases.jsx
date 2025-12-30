import React from 'react'
import { motion } from 'framer-motion'
import './UseCases.css'

const UseCases = () => {
  const useCases = [
    {
      label: 'Exam Prep | Practice & Prepare',
      title: 'Exam Preparation',
      description: 'Upload practice exams and review materials. TATE AI helps you practice explaining key concepts, identify weak areas, and build confidence before your exam.',
      examples: ['Practice explaining complex topics', 'Review past exam questions', 'Identify knowledge gaps']
    },
    {
      label: 'Lecture Review | Reinforce Learning',
      title: 'Lecture Review',
      description: 'Upload your class slides after each lecture. Have conversations with TATE AI to reinforce what you learned, clarify confusing points, and connect new concepts to previous material.',
      examples: ['Clarify lecture concepts', 'Connect new and old material', 'Reinforce key takeaways']
    },
    {
      label: 'Assignment Help | Think Through Problems',
      title: 'Assignment Help',
      description: 'Upload assignment prompts and your work. TATE AI helps you understand requirements, think through problems, and explain your reasoning—without giving away answers.',
      examples: ['Understand assignment requirements', 'Work through problems step-by-step', 'Explain your reasoning']
    },
    {
      label: 'Concept Mastery | Deep Dive',
      title: 'Concept Mastery',
      description: 'Struggling with a particular topic? Upload related materials and have extended conversations with TATE AI until you can confidently explain the concept in your own words.',
      examples: ['Deep dive into difficult topics', 'Practice explaining until it clicks', 'Build conceptual understanding']
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
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
    <section id="use-cases" className="use-cases">
      <div className="use-cases-container">
        <motion.div
          className="use-cases-header"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="section-label">// USE CASES</div>
          <h2 className="use-cases-title">
            Study Smarter, Not Harder
          </h2>
          <p className="use-cases-subtitle">
            TATE AI adapts to how you study, whether you're preparing for exams, reviewing lectures, or mastering new concepts.
          </p>
        </motion.div>

        <motion.div
          className="use-cases-grid"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {useCases.map((useCase, index) => (
            <motion.div
              key={index}
              className="use-case-card"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="use-case-label">{useCase.label}</div>
              <h3 className="use-case-title">{useCase.title}</h3>
              <p className="use-case-description">{useCase.description}</p>
              <ul className="use-case-examples">
                {useCase.examples.map((example, idx) => (
                  <li key={idx}>{example}</li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default UseCases

