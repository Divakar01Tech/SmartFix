import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getPortalToken, getPortalUser, setPortalAuth, clearPortalAuth, parseJwt, normalizeRole } from '../utils/authStorage';
import { getApiBase } from '../services/api';

/**
 * AdminRoute:
 * Guards administrator management console routes. Reads only hm_admin_token.
 * Verifies JWT & calls GET /api/auth/me with admin token.
 * Redirects to /admin/login on any auth failure.
 */
export default function AdminRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authenticated' | 'unauthorized'
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const verifyAdmin = async () => {
      const token = getPortalToken('admin');
      if (!token) {
        if (isMounted) setStatus('unauthorized');
        return;
      }

      const decoded = parseJwt(token);
      if (!decoded || normalizeRole(decoded.role) !== 'admin') {
        clearPortalAuth('admin');
        if (isMounted) setStatus('unauthorized');
        return;
      }

      try {
        const res = await fetch(`${getApiBase()}/auth/me`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          clearPortalAuth('admin');
          if (isMounted) setStatus('unauthorized');
          return;
        }

        const data = await res.json();
        const returnedRole = normalizeRole(data.user?.role || data.role);

        if (returnedRole !== 'admin') {
          clearPortalAuth('admin');
          if (isMounted) setStatus('unauthorized');
          return;
        }

        setPortalAuth('admin', token, data.user);
        if (isMounted) setStatus('authenticated');
      } catch (err) {
        if (decoded && normalizeRole(decoded.role) === 'admin') {
          if (isMounted) setStatus('authenticated');
        } else {
          clearPortalAuth('admin');
          if (isMounted) setStatus('unauthorized');
        }
      }
    };

    verifyAdmin();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center min-vh-75 py-5" style={{ background: '#0f172a', color: '#f8fafc' }}>
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Verifying Admin Console Privileges...</span>
        </div>
        <p className="text-secondary fw-semibold">Authenticating SmartFix Administration Console...</p>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
