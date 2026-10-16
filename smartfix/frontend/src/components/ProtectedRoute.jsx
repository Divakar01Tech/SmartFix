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

  const isWorkerTarget = allowedRoles && (allowedRoles.includes('worker') || allowedRoles.includes('handyman'));
  const isAdminTarget = allowedRoles && allowedRoles.includes('admin');

  if (!isAuthenticated) {
    if (isAdminTarget) {
      return <Navigate to="/admin/login" replace />;
    }
    if (isWorkerTarget) {
      return <Navigate to="/worker/login" replace />;
    }
    return <Navigate to="/customer/login" replace />;
  }

  // Profile completion check for Google users (customers)
  if (user?.role === 'customer' && (!user.phone || user.phone.startsWith('google_') || !user.profileCompleted)) {
    return <ProfileCompletion />;
  }

  // Check if route requires specific roles
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role === 'handyman' ? 'worker' : user?.role;
    const match = allowedRoles.some((r) => (r === 'handyman' ? 'worker' : r) === userRole);

    if (!match) {
      if (isAdminTarget) return <Navigate to="/admin/login" replace />;
      if (isWorkerTarget) return <Navigate to="/worker/login" replace />;
      return <Navigate to="/customer/login" replace />;
    }

    if (isAdminTarget) {
      const isAuthorizedAdmin = user?.email?.toLowerCase() === adminEmail.toLowerCase();
      if (!isAuthorizedAdmin) {
        return <Navigate to="/admin/login" replace />;
      }
    }
  }

  return children;
};

export default ProtectedRoute;
