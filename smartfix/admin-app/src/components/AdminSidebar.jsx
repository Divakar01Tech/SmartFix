import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, ShieldCheck, ClipboardList, CreditCard, Settings, LogOut, Shield } from 'lucide-react';
import './AdminSidebar.css';

const NAV = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/verification', icon: ShieldCheck,     label: 'KYC Queue' },
  { to: '/users',        icon: Users,           label: 'Users' },
  { to: '/bookings',     icon: ClipboardList,   label: 'Bookings' },
  { to: '/payments',     icon: CreditCard,      label: 'Payments' },
  { to: '/commission',   icon: Settings,        label: 'Commission' },
];

export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon"><Shield size={20} /></div>
        <div>
          <div className="brand-name">HandyBook</div>
          <div className="brand-sub">Admin Console</div>
        </div>
      </div>

      {user && (
        <div className="sidebar-user">
          <div className="admin-avatar">A</div>
          <div>
            <div className="admin-name">{user.name}</div>
            <div className="admin-role">Administrator (7604975206)</div>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <Link key={to} to={to} className={`nav-item ${pathname === to ? 'active' : ''}`}>
            <Icon size={18} /> <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="version-info">v1.0.0 · Admin Panel</div>
        <button className="logout-btn" onClick={logout}><LogOut size={16} /> Sign Out</button>
      </div>
    </aside>
  );
}
