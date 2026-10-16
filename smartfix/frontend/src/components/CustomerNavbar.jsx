import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Wrench, User, LogOut, Wallet, Calendar, Search, Sun, Moon, Bell, ShieldCheck, CreditCard } from 'lucide-react';
import './CustomerNavbar.css';

export default function CustomerNavbar() {
  const { customerUser, logoutCustomer } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const location = useLocation();

  const handleLogout = () => {
    setDropdownOpen(false);
    logoutCustomer();
  };

  return (
    <header className="customer-navbar shadow-sm sticky-top">
      <div className="container d-flex justify-content-between align-items-center py-2">
        {/* Brand */}
        <Link to="/customer/home" className="navbar-brand d-flex align-items-center gap-2 text-decoration-none">
          <div className="customer-logo-box">
            <Wrench size={18} color="#ffffff" />
          </div>
          <span className="customer-brand-text">
            Smart<strong>Fix</strong>
            <span className="badge bg-primary text-white ms-2" style={{ fontSize: '0.68rem', verticalAlign: 'middle' }}>
              Customer
            </span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="d-none d-md-flex align-items-center gap-3">
          <Link
            to="/customer/home"
            className={`customer-nav-link ${location.pathname === '/customer/home' ? 'active' : ''}`}
          >
            Dashboard
          </Link>
          <Link
            to="/customer/services"
            className={`customer-nav-link ${location.pathname === '/customer/services' ? 'active' : ''}`}
          >
            Services
          </Link>
          <Link
            to="/customer/experts"
            className={`customer-nav-link ${location.pathname === '/customer/experts' ? 'active' : ''}`}
          >
            Browse Experts
          </Link>
          <Link
            to="/customer/bookings"
            className={`customer-nav-link ${location.pathname === '/customer/bookings' ? 'active' : ''}`}
          >
            My Bookings
          </Link>
          <Link
            to="/customer/wallet"
            className={`customer-nav-link ${location.pathname === '/customer/wallet' ? 'active' : ''}`}
          >
            Wallet
          </Link>
        </nav>

        {/* Right Controls */}
        <div className="d-flex align-items-center gap-2">
          {/* Language Toggle */}
          <div className="btn-group p-1 bg-light rounded-pill border" role="group">
            <button
              type="button"
              className={`btn btn-sm rounded-pill fw-bold px-2 py-0 ${language === 'en' ? 'btn-primary text-white' : 'btn-light text-secondary'}`}
              onClick={() => setLanguage('en')}
              style={{ fontSize: '0.75rem' }}
            >
              EN
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill fw-bold px-2 py-0 ${language === 'ta' ? 'btn-primary text-white' : 'btn-light text-secondary'}`}
              onClick={() => setLanguage('ta')}
              style={{ fontSize: '0.75rem' }}
            >
              தமிழ்
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            className="btn btn-sm btn-light border rounded-circle p-2"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} color="#f59e0b" />}
          </button>

          {/* User Profile / Logout Dropdown */}
          {customerUser ? (
            <div className="dropdown position-relative">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 d-flex align-items-center gap-2 fw-semibold"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <User size={15} />
                <span className="d-none d-sm-inline">{customerUser.name || 'Account'}</span>
              </button>

              {dropdownOpen && (
                <div
                  className="dropdown-menu show shadow-lg border-0 rounded-3 position-absolute end-0 mt-2 py-2"
                  style={{ minWidth: '200px', zIndex: 1050 }}
                >
                  <div className="px-3 py-2 border-bottom">
                    <strong className="d-block text-dark small">{customerUser.name || 'Customer'}</strong>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{customerUser.email || customerUser.phone}</span>
                  </div>
                  <Link
                    to="/customer/profile"
                    className="dropdown-item py-2 d-flex align-items-center gap-2 small"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User size={14} /> Profile & Settings
                  </Link>
                  <Link
                    to="/customer/bookings"
                    className="dropdown-item py-2 d-flex align-items-center gap-2 small"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Calendar size={14} /> My Bookings
                  </Link>
                  <Link
                    to="/customer/wallet"
                    className="dropdown-item py-2 d-flex align-items-center gap-2 small"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Wallet size={14} /> Wallet
                  </Link>
                  <Link
                    to="/customer/payments"
                    className="dropdown-item py-2 d-flex align-items-center gap-2 small"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <CreditCard size={14} /> Payment History
                  </Link>
                  <div className="dropdown-divider"></div>
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
            <Link to="/customer/login" className="btn btn-sm btn-primary rounded-pill px-3 fw-bold">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
