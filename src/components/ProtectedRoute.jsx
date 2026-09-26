import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Wait for the stored session to load before deciding — otherwise a refresh on
  // a protected page would bounce a signed-in user to the login screen.
  if (loading) {
    // The spinner is drawn by .route-loading::before, so the text here is the
    // label beside it rather than the whole indicator.
    return (
      <div className="route-loading" role="status">
        Restoring your session
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export default ProtectedRoute
