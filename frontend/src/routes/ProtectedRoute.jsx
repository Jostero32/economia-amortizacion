import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-700"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si se especifican roles permitidos
  if (allowedRoles.length > 0) {
    const userRole = user.rol;
    const hasRole = allowedRoles.includes(userRole) || (allowedRoles.includes('ASESOR') && userRole === 'ADMIN');
    if (!hasRole) {
      // Redirigir a su panel correspondiente según su rol
      if (userRole === 'ADMIN') return <Navigate to="/admin" replace />;
      if (userRole === 'ASESOR') return <Navigate to="/admin/solicitudes" replace />;
      return <Navigate to="/cliente" replace />;
    }
  }

  return children;
}
