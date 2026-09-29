import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, ClipboardList, Wallet, User, LogOut, Zap, Bell } from 'lucide-react';
import { useState } from 'react';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <div className="brand-icon"><Zap size={20} fill="#fff" /></div>
          <span>HandyBook</span>
        </Link>

        {user ? (
          <div className="navbar-right">
            <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)}>
              <Bell size={20} />
              <span className="notif-dot" />
            </button>

            <div className="nav-links">
              <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
                <Home size={16} /> Home
              </Link>
              <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
                <ClipboardList size={16} /> Bookings
              </Link>
              <Link to="/profile" className={`nav-link ${isActive('/profile') ? 'active' : ''}`}>
                <User size={16} /> Profile
              </Link>
            </div>

            <div className="nav-user">
              <div className="avatar">{user.name?.charAt(0).toUpperCase()}</div>
              <div className="user-info">
                <span className="user-name">{user.name?.split(' ')[0]}</span>
                <span className="user-role">Customer</span>
              </div>
              <button className="logout-btn" onClick={logout} title="Logout"><LogOut size={16} /></button>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/login')}>Sign In</button>
        )}
      </div>
    </nav>
  );
}
