import React, { useState, useEffect, useMemo } from 'react'
import './DotBackground.css'

const DotBackground = () => {
  const [mousePosition, setMousePosition] = useState({ x: -1000, y: -1000 })
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)

    const handleMouseMove = (e) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  // Generate dots in a grid pattern
  const dots = useMemo(() => {
    const dotSpacing = 30
    const rows = Math.ceil(dimensions.height / dotSpacing) + 2
    const cols = Math.ceil(dimensions.width / dotSpacing) + 2
    const dotArray = []

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        dotArray.push({
          id: `${i}-${j}`,
          x: j * dotSpacing,
          y: i * dotSpacing
        })
      }
    }
    return dotArray
  }, [dimensions.width, dimensions.height])

  const getDotColor = (dotX, dotY) => {
    const distance = Math.sqrt(
      Math.pow(mousePosition.x - dotX, 2) + Math.pow(mousePosition.y - dotY, 2)
    )
    const maxDistance = 150
    const intensity = Math.max(0, 1 - distance / maxDistance)
    
    if (intensity > 0) {
      // Interpolate between light gray and green based on distance
      const greenIntensity = Math.min(1, intensity * 0.9)
      return `rgba(16, 185, 129, ${greenIntensity})`
    }
    return 'rgba(209, 213, 219, 0.6)' // darker gray for more contrast
  }

  return (
    <div className="dot-background">
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="dot"
          style={{
            left: `${dot.x}px`,
            top: `${dot.y}px`,
            backgroundColor: getDotColor(dot.x, dot.y)
          }}
        />
      ))}
    </div>
  )
}

export default DotBackground
