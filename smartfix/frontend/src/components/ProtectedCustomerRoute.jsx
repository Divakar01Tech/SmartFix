import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiBase } from '../services/api';

const ProtectedCustomerRoute = ({ children }) => {
  const { user, token, logout } = useAuth();
  const [verifying, setVerifying] = useState(true);
  const [isCustomer, setIsCustomer] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const verifyCustomer = async () => {
      const activeToken = token || localStorage.getItem('smartfix_token') || localStorage.getItem('token');
      if (!activeToken) {
        if (isMounted) {
          setIsCustomer(false);
          setVerifying(false);
        }
        return;
      }

      try {
        const res = await fetch(`${getApiBase()}/users/me`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          const role = data.user?.role || data.role;
          if (role === 'customer') {
            if (isMounted) setIsCustomer(true);
          } else {
            if (isMounted) setIsCustomer(false);
          }
        } else {
          // Token invalid or expired
          if (isMounted) setIsCustomer(false);
        }
      } catch (err) {
        // Fallback to local auth context if network hiccup
        if (user && user.role === 'customer') {
          if (isMounted) setIsCustomer(true);
        } else {
          if (isMounted) setIsCustomer(false);
        }
      } finally {
        if (isMounted) setVerifying(false);
      }
    };

    verifyCustomer();

    return () => {
      isMounted = false;
    };
  }, [token, user]);

  if (verifying) {
    return (
      <div className="d-flex flex-column justify-content-center align-items-center min-vh-50 py-5">
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Verifying Customer Session...</span>
        </div>
        <p className="text-muted fw-semibold">Authenticating SmartFix Customer Portal...</p>
      </div>
    );
  }

  if (!isCustomer) {
    return <Navigate to="/customer/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedCustomerRoute;
