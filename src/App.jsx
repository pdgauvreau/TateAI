import React from 'react'
import Hero from './components/Hero'
import Features from './components/Features'
import HowItWorks from './components/HowItWorks'
import ResearchBenefits from './components/ResearchBenefits'
import UseCases from './components/UseCases'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import DotBackground from './components/DotBackground'
import './App.css'

function App() {
  return (
    <div className="App">
      <DotBackground />
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <ResearchBenefits />
      <UseCases />
      <Footer />
    </div>
  )
}

export default App

