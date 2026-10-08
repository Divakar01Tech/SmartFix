import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileCompletion from './ProfileCompletion';

const ProtectedRoute = ({ children, allowedRoles, adminEmail = 'muthudivakar01022006@gmail.com', adminPhone = '7604975206' }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Profile completion check for Google users
  if (!user.phone || user.phone.startsWith('google_')) {
    return <ProfileCompletion />;
  }

  // Check if route requires specific roles
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user?.role)) {
      // If user is logged in but doesn't have the right role, redirect to their respective dashboard
      if (user?.role === 'admin') return <Navigate to="/admin" replace />;
      if (user?.role === 'handyman') return <Navigate to="/handyman-dashboard" replace />;
      return <Navigate to="/dashboard" replace />;
    }

    // Extra security check for Admin role based on user's requirements
    if (allowedRoles.includes('admin')) {
      const isAuthorizedAdmin = user?.email === adminEmail || user?.phone === adminPhone || user?.phone === `+91${adminPhone}`;
      if (!isAuthorizedAdmin) {
        // Fallback if someone somehow got the admin role but doesn't match the specific credentials
        return <Navigate to="/" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
