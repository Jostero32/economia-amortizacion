import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-700"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (user.rol === 'ADMIN' || user.rol === 'ASESOR') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/cliente" replace />;
  }

  return children;
}
