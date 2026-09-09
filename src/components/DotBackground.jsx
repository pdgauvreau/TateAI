import React, { useEffect, useRef } from 'react'
import './DotBackground.css'

// The dot grid is drawn with two CSS gradient layers rather than one div per dot:
// a static gray field, and a green copy revealed through a mask that follows the
// cursor. The pointer position is written straight to CSS custom properties on
// the container, so moving the mouse never re-renders React.
const DotBackground = () => {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Nothing to follow on touch devices, and honouring reduced-motion keeps the
    // static grid without the chasing highlight.
    const wantsMotion = window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!wantsMotion) return

    let frame = 0
    let pending = null

    const flush = () => {
      frame = 0
      if (!pending) return
      el.style.setProperty('--mouse-x', `${pending.x}px`)
      el.style.setProperty('--mouse-y', `${pending.y}px`)
      el.style.setProperty('--highlight-opacity', '1')
    }

    // Coalesce to one write per animation frame; mousemove can fire far faster.
    const handleMouseMove = (event) => {
      pending = { x: event.clientX, y: event.clientY }
      if (!frame) frame = requestAnimationFrame(flush)
    }

    const handleMouseLeave = () => {
      el.style.setProperty('--highlight-opacity', '0')
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div className="dot-background" ref={containerRef} aria-hidden="true">
      <div className="dot-layer dot-layer-base" />
      <div className="dot-layer dot-layer-highlight" />
    </div>
  )
}

export default DotBackground
