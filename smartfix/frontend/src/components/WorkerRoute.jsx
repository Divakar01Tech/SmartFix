import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getPortalToken, getPortalUser, setPortalAuth, clearPortalAuth, parseJwt, normalizeRole } from '../utils/authStorage';
import { getApiBase } from '../services/api';

/**
 * WorkerRoute:
 * Guards worker (service provider) portal routes. Reads only hm_worker_token.
 * Verifies JWT & calls GET /api/auth/me with worker token.
 * Redirects to /worker/login on any auth failure.
 * Handles worker KYC status gating.
 */
export default function WorkerRoute({ children, allowPending = false }) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'approved' | 'pending' | 'rejected' | 'suspended' | 'unauthorized'
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const verifyWorker = async () => {
      const token = getPortalToken('worker');
      if (!token) {
        if (isMounted) setStatus('unauthorized');
        return;
      }

      const decoded = parseJwt(token);
      if (!decoded || normalizeRole(decoded.role) !== 'worker') {
        clearPortalAuth('worker');
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
          clearPortalAuth('worker');
          if (isMounted) setStatus('unauthorized');
          return;
        }

        const data = await res.json();
        const returnedRole = normalizeRole(data.user?.role || data.role);

        if (returnedRole !== 'worker') {
          clearPortalAuth('worker');
          if (isMounted) setStatus('unauthorized');
          return;
        }

        const workerDoc = data.user || {};
        setPortalAuth('worker', token, workerDoc);

        if (workerDoc.isBlocked || workerDoc.isSuspended || workerDoc.verificationStatus === 'suspended') {
          if (isMounted) setStatus('suspended');
          return;
        }

        const vStatus = (workerDoc.verificationStatus || '').toLowerCase();
        if (vStatus === 'pending_verification' || vStatus === 'pending') {
          if (isMounted) setStatus(allowPending ? 'approved' : 'pending');
        } else if (vStatus === 'rejected') {
          if (isMounted) setStatus(allowPending ? 'approved' : 'rejected');
        } else {
          if (isMounted) setStatus('approved');
        }
      } catch (err) {
        if (decoded && normalizeRole(decoded.role) === 'worker') {
          if (isMounted) setStatus('approved');
        } else {
          clearPortalAuth('worker');
          if (isMounted) setStatus('unauthorized');
        }
      }
    };

    verifyWorker();

    return () => {
      isMounted = false;
    };
  }, [allowPending]);

  if (status === 'checking') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', background: '#0f172a', color: '#f8fafc' }}>
        <div className="spinner-border text-warning" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Validating Provider Credentials...</span>
        </div>
        <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '0.95rem' }}>Verifying Technician Portal Access...</p>
      </div>
    );
  }

  if (status === 'unauthorized') {
    return <Navigate to="/worker/login" state={{ from: location }} replace />;
  }

  if (status === 'pending') {
    return <Navigate to="/worker/pending" replace />;
  }

  if (status === 'rejected') {
    return <Navigate to="/worker/rejected" replace />;
  }

  if (status === 'suspended') {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '24px' }}>
        <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '16px', padding: '36px', maxWidth: '480px', width: '100%', textAlign: 'center', color: '#f8fafc', boxShadow: '0 10px 25px rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚫</div>
          <h2 style={{ color: '#ef4444', fontWeight: '800', marginBottom: '12px' }}>Account Suspended</h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', marginBottom: '24px' }}>
            Your service partner privileges have been temporarily suspended. Please contact SmartFix Admin Support for assistance.
          </p>
          <button
            onClick={() => {
              clearPortalAuth('worker');
              window.location.href = '/worker/login';
            }}
            style={{ background: '#334155', color: '#ffffff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return children;
}
