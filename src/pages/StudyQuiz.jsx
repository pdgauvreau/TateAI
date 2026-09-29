import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import DotBackground from '../components/DotBackground'
import MessageContent from '../components/MessageContent'
import { getQuiz, recordQuizAttempt } from '../lib/study'
import { ease, spring } from '../motion/tokens'
import { BackLink } from './StudyCards'
import './StudyPage.css'

const LETTERS = ['A', 'B', 'C', 'D']

/**
 * Taking a practice quiz.
 *
 * One question at a time, with the answer and its explanation shown as soon as
 * a choice is made: feedback while the question is still in mind teaches more
 * than a score at the end. The end screen lists what was missed so the student
 * can go straight back to those.
 */
const StudyQuiz = () => {
  const { id } = useParams()
  const [quiz, setQuiz] = useState(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getQuiz(id).then((result) => {
      if (!active) return
      if (result.error) setError(result.error)
      else setQuiz(result.quiz)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  const questions = quiz?.questions ?? []
  const question = questions[index]
  const picked = answers[index]
  const answered = picked !== undefined
  const score = answers.filter((a, i) => a === questions[i]?.answer).length

  const pick = (choice) => {
    if (answered) return
    setAnswers((prev) => {
      const next = [...prev]
      next[index] = choice
      return next
    })
  }

  const next = async () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1)
      return
    }
    setFinished(true)
    const result = await recordQuizAttempt(quiz, score)
    if (result.error) setError(result.error)
    else setQuiz((prev) => ({ ...prev, ...result }))
  }

  const retake = () => {
    setIndex(0)
    setAnswers([])
    setFinished(false)
  }

  const missed = questions.map((q, i) => ({ q, i })).filter(({ q, i }) => answers[i] !== q.answer)

  return (
    <div className="page study-page">
      <DotBackground variant="bare" />
      <div className="page-narrow">
        <BackLink />

        <header className="study-head">
          <span className="eyebrow">Practice quiz</span>
          <h1 className="study-title">{loading ? <span className="skeleton study-title-skel" /> : quiz?.title}</h1>
          {quiz && !finished && (
            <div className="quiz-progress" aria-label={`Question ${index + 1} of ${questions.length}`}>
              {questions.map((q, i) => (
                <span
                  key={i}
                  className={`quiz-pip ${i === index ? 'is-current' : ''} ${
                    answers[i] === undefined ? '' : answers[i] === q.answer ? 'is-right' : 'is-wrong'
                  }`}
                />
              ))}
            </div>
          )}
        </header>

        {error && (
          <div className="note note-error" role="alert">
            {error}
          </div>
        )}

        {quiz && (
          <AnimatePresence mode="wait">
            {!finished && question ? (
              <motion.div
                key={index}
                className="quiz-card panel rim"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.3, ease: ease.out }}
              >
                <span className="flashcard-side">
                  Question {index + 1} of {questions.length}
                </span>
                <div className="quiz-question">
                  <MessageContent text={question.question} />
                </div>

                <div className="quiz-choices" role="radiogroup">
                  {question.choices.map((choice, c) => {
                    const state = !answered
                      ? ''
                      : c === question.answer
                        ? 'is-right'
                        : c === picked
                          ? 'is-wrong'
                          : 'is-faded'
                    return (
                      <motion.button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={picked === c}
                        className={`quiz-choice ${state}`}
                        onClick={() => pick(c)}
                        disabled={answered}
                        whileTap={answered ? undefined : { scale: 0.98 }}
                        transition={spring.snap}
                      >
                        <span className="quiz-letter">{LETTERS[c]}</span>
                        <MessageContent text={choice} />
                      </motion.button>
                    )
                  })}
                </div>

                <AnimatePresence>
                  {answered && (
                    <motion.div
                      className={`quiz-feedback ${picked === question.answer ? 'is-right' : 'is-wrong'}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3, ease: ease.out }}
                    >
                      <p className="quiz-verdict">
                        {picked === question.answer ? 'Right.' : `Not quite — the answer is ${LETTERS[question.answer]}.`}
                      </p>
                      <MessageContent text={question.explanation} />
                      <button type="button" className="btn btn-primary study-go" onClick={next} autoFocus>
                        {index + 1 < questions.length ? 'Next question' : 'See my score'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                key="done"
                className="study-done panel rim"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: ease.out }}
              >
                <p className="study-done-title">
                  {score} / {questions.length}
                </p>
                <p className="study-done-body">
                  {score === questions.length
                    ? 'Every one right.'
                    : `Best so far: ${quiz.best_score ?? score} / ${questions.length}. Go back over the ones below, then try it again.`}
                </p>

                {missed.length > 0 && (
                  <ul className="quiz-missed">
                    {missed.map(({ q, i }) => (
                      <li key={i}>
                        <MessageContent text={q.question} />
                        <p className="quiz-missed-answer">
                          <strong>Answer:</strong> {LETTERS[q.answer]}.
                        </p>
                        <MessageContent text={q.choices[q.answer]} />
                        <div className="quiz-missed-why">
                          <MessageContent text={q.explanation} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <button type="button" className="btn btn-quiet" onClick={retake}>
                  Take it again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

export default StudyQuiz
