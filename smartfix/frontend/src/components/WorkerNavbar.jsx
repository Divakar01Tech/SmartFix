import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Wrench, User, LogOut, DollarSign, Calendar, Bell, ShieldCheck, CheckCircle2 } from 'lucide-react';
import './WorkerNavbar.css';

export default function WorkerNavbar() {
  const { workerUser, logoutWorker } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    setDropdownOpen(false);
    logoutWorker();
  };

  const isOnline = workerUser?.isOnline !== false;

  return (
    <header className="worker-navbar shadow-sm sticky-top">
      <div className="container d-flex justify-content-between align-items-center py-2">
        {/* Brand */}
        <Link to="/worker/dashboard" className="navbar-brand d-flex align-items-center gap-2 text-decoration-none">
          <div className="worker-logo-box">
            <Wrench size={18} color="#0f172a" />
          </div>
          <span className="worker-brand-text">
            Smart<strong>Fix</strong>
            <span className="badge bg-warning text-dark ms-2 fw-bold" style={{ fontSize: '0.68rem', verticalAlign: 'middle' }}>
              Partner Pro
            </span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="d-none d-md-flex align-items-center gap-3">
          <Link
            to="/worker/dashboard"
            className={`worker-nav-link ${location.pathname === '/worker/dashboard' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link
            to="/worker/requests"
            className={`worker-nav-link ${location.pathname === '/worker/requests' ? 'active' : ''}`}
          >
            Job Requests
          </Link>
          <Link
            to="/worker/jobs"
            className={`worker-nav-link ${location.pathname === '/worker/jobs' ? 'active' : ''}`}
          >
            My Jobs
          </Link>
          <Link
            to="/worker/earnings"
            className={`worker-nav-link ${location.pathname === '/worker/earnings' ? 'active' : ''}`}
          >
            Earnings
          </Link>
        </nav>

        {/* Right Controls */}
        <div className="d-flex align-items-center gap-2">
          {/* Status Indicator */}
          {workerUser && (
            <span className={`badge rounded-pill d-none d-sm-inline-flex align-items-center gap-1 px-2 py-1 ${isOnline ? 'bg-success text-white' : 'bg-secondary text-white'}`} style={{ fontSize: '0.72rem' }}>
              {isOnline ? '🟢 Available' : '🔴 Offline'}
            </span>
          )}

          {/* User Profile / Logout Dropdown */}
          {workerUser ? (
            <div className="dropdown position-relative">
              <button
                type="button"
                className="btn btn-sm btn-outline-warning rounded-pill px-3 py-1 d-flex align-items-center gap-2 fw-semibold"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <User size={15} />
                <span className="d-none d-sm-inline">{workerUser.name || 'Technician'}</span>
              </button>

              {dropdownOpen && (
                <div
                  className="dropdown-menu show shadow-lg border-0 rounded-3 position-absolute end-0 mt-2 py-2"
                  style={{ minWidth: '220px', zIndex: 1050, background: '#1e293b', border: '1px solid #334155' }}
                >
                  <div className="px-3 py-2 border-bottom border-secondary">
                    <strong className="d-block text-white small">{workerUser.name || 'Technician'}</strong>
                    <span className="text-secondary" style={{ fontSize: '0.75rem' }}>{workerUser.email || workerUser.phone}</span>
                    <span className="badge bg-warning text-dark d-block mt-1" style={{ fontSize: '0.65rem' }}>
                      {workerUser.trade || 'Handyman'}
                    </span>
                  </div>
                  <Link
                    to="/worker/profile"
                    className="dropdown-item py-2 d-flex align-items-center gap-2 small text-light"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User size={14} /> Profile & KYC Details
                  </Link>
                  <Link
                    to="/worker/earnings"
                    className="dropdown-item py-2 d-flex align-items-center gap-2 small text-light"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <DollarSign size={14} /> Earnings & Payouts
                  </Link>
                  <div className="dropdown-divider border-secondary"></div>
                  <button
                    type="button"
                    className="dropdown-item text-danger py-2 d-flex align-items-center gap-2 small"
                    onClick={handleLogout}
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/worker/login" className="btn btn-sm btn-warning rounded-pill px-3 fw-bold text-dark">
              Partner Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
