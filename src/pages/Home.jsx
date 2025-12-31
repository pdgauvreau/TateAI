import React from 'react'
import Hero from '../components/Hero'
import Features from '../components/Features'
import HowItWorks from '../components/HowItWorks'
import ResearchBenefits from '../components/ResearchBenefits'
import UseCases from '../components/UseCases'
import DotBackground from '../components/DotBackground'

const Home = () => {
  return (
    <>
      <DotBackground />
      <Hero />
      <Features />
      <HowItWorks />
      <ResearchBenefits />
      <UseCases />
    </>
  )
}

export default Home

