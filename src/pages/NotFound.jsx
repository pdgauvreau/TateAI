import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import SplitText from '../components/motion/SplitText'
import { Magnetic } from '../components/motion/Interactive'
import { ease, spring } from '../motion/tokens'
import './NotFound.css'

/**
 * 404.
 *
 * The digits are the whole design: they drift on three separate loops with
 * different periods, so the group never resolves into a repeating pattern, and
 * each one springs in with its own delay. Worth the effort because this is a page
 * people arrive at annoyed.
 */
const NotFound = () => (
  <div className="page nf">
    <DotBackground />

    <div className="nf-inner">
      <div className="nf-digits" aria-hidden="true">
        {['4', '0', '4'].map((digit, i) => (
          <motion.span
            key={i}
            className="nf-digit"
            initial={{ opacity: 0, y: 60, rotate: i === 1 ? -14 : 8, scale: 0.7 }}
            animate={{
              opacity: 1,
              y: [0, i === 1 ? -14 : -8, 0],
              rotate: i === 1 ? -6 : 3,
              scale: 1,
            }}
            transition={{
              opacity: { duration: 0.5, delay: i * 0.12 },
              scale: { ...spring.pop, delay: i * 0.12 },
              rotate: { duration: 0.8, ease: ease.out, delay: i * 0.12 },
              y: {
                duration: 4.5 + i * 0.9,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.6 + i * 0.3,
              },
            }}
          >
            {digit}
          </motion.span>
        ))}
      </div>

      <h1 className="nf-title">
        <SplitText trigger="mount" by="word" delay={0.45}>
          Nothing here to explain
        </SplitText>
      </h1>

      <motion.p
        className="nf-body"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: ease.out, delay: 0.75 }}
      >
        That page doesn’t exist, or it has moved. Your documents and conversations
        are where you left them.
      </motion.p>

      <motion.div
        className="nf-actions"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: ease.out, delay: 0.9 }}
      >
        <Magnetic strength={0.2}>
          <Link to="/">
            <motion.span
              className="btn btn-primary"
              whileHover={{ scale: 1.035 }}
              whileTap={{ scale: 0.97 }}
              transition={spring.snap}
            >
              Back to home
            </motion.span>
          </Link>
        </Magnetic>

        <Magnetic strength={0.14}>
          <Link to="/dashboard">
            <motion.span
              className="btn btn-ghost"
              whileHover={{ scale: 1.035 }}
              whileTap={{ scale: 0.97 }}
              transition={spring.snap}
            >
              Go to dashboard
            </motion.span>
          </Link>
        </Magnetic>
      </motion.div>
    </div>
  </div>
)

export default NotFound
