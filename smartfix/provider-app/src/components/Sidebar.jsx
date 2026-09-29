import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Briefcase, DollarSign, Clock, User, LogOut, Zap } from 'lucide-react';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/earnings', icon: DollarSign,       label: 'Earnings' },
  { to: '/history',  icon: Clock,            label: 'History' },
  { to: '/profile',  icon: User,             label: 'Profile' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-icon"><Zap size={18} fill="#0D0D1A" /></div>
        <div>
          <div className="brand-name">HandyBook</div>
          <div className="brand-sub">Provider Portal</div>
        </div>
      </div>

      {/* User info */}
      {user && (
        <div className="sidebar-user">
          <div className="user-avatar">{user.name?.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <div className="user-name">{user.name?.split(' ')[0]}</div>
            <div className="user-trade">{user.trade || 'Professional'}</div>
          </div>
          <div className="online-dot" title="Online" />
        </div>
      )}

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`nav-item ${location.pathname === to ? 'active' : ''}`}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={logout}>
          <LogOut size={18} /> Sign Out
        </button>
        <div className="footer-note">Customer App →</div>
        <a href="http://localhost:5173" target="_blank" rel="noreferrer" className="portal-link">
          Switch to Customer
        </a>
      </div>
    </aside>
  );
}
