import React from 'react'
import Hero from '../components/Hero'
import Features from '../components/Features'
import HowItWorks from '../components/HowItWorks'
import ResearchBenefits from '../components/ResearchBenefits'
import UseCases from '../components/UseCases'
import CallToAction from '../components/CallToAction'
import DotBackground from '../components/DotBackground'

/**
 * The marketing page, in the order the argument is made: what it is, what it
 * does, how it works, why that works, when you would reach for it, and then the
 * ask.
 */
const Home = () => (
  <>
    <DotBackground />
    <Hero />
    <Features />
    <HowItWorks />
    <ResearchBenefits />
    <UseCases />
    <CallToAction />
  </>
)

export default Home
