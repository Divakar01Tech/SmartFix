import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getPortalToken, getPortalUser, setPortalAuth, clearPortalAuth, parseJwt, normalizeRole } from '../utils/authStorage';
import { getApiBase } from '../services/api';

/**
 * CustomerRoute:
 * Guards customer portal routes. Reads only hm_customer_token.
 * Verifies JWT & calls GET /api/auth/me with customer token.
 * Redirects to /customer/login on any auth failure.
 */
export default function CustomerRoute({ children }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'authenticated' | 'unauthorized'
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const verifyCustomer = async () => {
      const token = getPortalToken('customer');
      if (!token) {
        if (isMounted) setStatus('unauthorized');
        return;
      }

      const decoded = parseJwt(token);
      if (!decoded || normalizeRole(decoded.role) !== 'customer') {
        clearPortalAuth('customer');
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
          clearPortalAuth('customer');
          if (isMounted) setStatus('unauthorized');
          return;
        }

        const data = await res.json();
        const returnedRole = normalizeRole(data.user?.role || data.role);

        if (returnedRole !== 'customer') {
          clearPortalAuth('customer');
          if (isMounted) setStatus('unauthorized');
          return;
        }

        // Keep local cache fresh
        setPortalAuth('customer', token, data.user);
        if (isMounted) setStatus('authenticated');
      } catch (err) {
        // Fallback to local decoded token if network error occurs
        if (decoded && normalizeRole(decoded.role) === 'customer') {
          if (isMounted) setStatus('authenticated');
        } else {
          clearPortalAuth('customer');
          if (isMounted) setStatus('unauthorized');
        }
      }
    };

    verifyCustomer();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === 'checking') {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center min-vh-50 py-5">
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Validating Customer Access...</span>
        </div>
        <p className="text-muted fw-semibold">Loading Customer Portal...</p>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/customer/login" state={{ from: location }} replace />;
  }

  return children;
}
