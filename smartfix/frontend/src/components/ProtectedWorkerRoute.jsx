import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

const ProtectedWorkerRoute = ({ children }) => {
  const [worker, setWorker] = useState(() => {
    try {
      const stored = localStorage.getItem('smartfix_worker');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkWorkerAuth = async () => {
      const token = localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const freshWorker = await apiService.workerGetMe(token);
        if (freshWorker) {
          setWorker(freshWorker);
          localStorage.setItem('smartfix_worker', JSON.stringify(freshWorker));
        }
      } catch (err) {
        console.warn('Worker session verification warning:', err.message);
      } finally {
        setLoading(false);
      }
    };

    checkWorkerAuth();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', background: '#0f172a', color: '#f8fafc' }}>
        <div className="spinner-border text-warning" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '0.95rem' }}>Verifying Provider Credentials...</p>
      </div>
    );
  }

  const token = localStorage.getItem('smartfix_worker_token') || localStorage.getItem('smartfix_token');
  if (!token || !worker) {
    return <Navigate to="/worker/login" replace />;
  }

  const status = (worker.verificationStatus || '').toLowerCase();

  if (status === 'pending_verification' || status === 'pending') {
    return <Navigate to="/worker/pending" replace />;
  }

  if (status === 'rejected') {
    return <Navigate to="/worker/rejected" replace />;
  }

  if (status === 'suspended' || worker.isSuspended || worker.isBlocked) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', padding: '24px' }}>
        <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: '16px', padding: '36px', maxWidth: '480px', width: '100%', textAlign: 'center', color: '#f8fafc', boxShadow: '0 10px 25px rgba(239,68,68,0.2)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🚫</div>
          <h2 style={{ color: '#ef4444', fontWeight: '800', marginBottom: '12px' }}>Account Suspended</h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', marginBottom: '24px' }}>
            Your service partner privileges have been temporarily suspended. Please contact SmartFix Admin Support for assistance.
          </p>
          <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', marginBottom: '24px' }}>
            📞 Support Helpline: <strong>+91 76049 75206</strong><br />
            📧 Email: <strong>support@smartfix.in</strong>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('smartfix_worker_token');
              localStorage.removeItem('smartfix_worker');
              navigate('/worker/login');
            }}
            style={{ background: '#334155', color: '#ffffff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // Approved status
  return children;
};

export default ProtectedWorkerRoute;
