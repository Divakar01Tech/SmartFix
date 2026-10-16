import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Users, Calendar, DollarSign, Settings, LogOut, BarChart3, Activity, CreditCard } from 'lucide-react';
import './AdminNavbar.css';

export default function AdminNavbar() {
  const { adminUser, logoutAdmin } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logoutAdmin();
  };

  return (
    <header className="admin-navbar shadow-sm sticky-top">
      <div className="container-fluid px-4 d-flex justify-content-between align-items-center py-2">
        {/* Brand */}
        <Link to="/admin/dashboard" className="navbar-brand d-flex align-items-center gap-2 text-decoration-none">
          <div className="admin-logo-box">
            <ShieldCheck size={20} color="#ffffff" />
          </div>
          <span className="admin-brand-text">
            Smart<strong>Fix</strong>
            <span className="badge bg-danger text-white ms-2 fw-bold" style={{ fontSize: '0.68rem', verticalAlign: 'middle' }}>
              ADMIN
            </span>
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="d-none d-lg-flex align-items-center gap-2">
          <Link
            to="/admin/dashboard"
            className={`admin-nav-link ${location.pathname === '/admin/dashboard' || location.pathname === '/admin' ? 'active' : ''}`}
          >
            <Activity size={15} /> Overview
          </Link>
          <Link
            to="/admin/kyc"
            className={`admin-nav-link ${location.pathname === '/admin/kyc' ? 'active' : ''}`}
          >
            <ShieldCheck size={15} /> KYC Approval Queue
          </Link>
          <Link
            to="/admin/bookings"
            className={`admin-nav-link ${location.pathname === '/admin/bookings' ? 'active' : ''}`}
          >
            <Calendar size={15} /> Bookings
          </Link>
          <Link
            to="/admin/settings"
            className={`admin-nav-link ${location.pathname === '/admin/settings' ? 'active' : ''}`}
          >
            <Settings size={15} /> Settings & Commission
          </Link>
          <Link
            to="/admin/wallet"
            className={`admin-nav-link ${location.pathname === '/admin/wallet' ? 'active' : ''}`}
          >
            <DollarSign size={15} /> Platform Wallet
          </Link>
          <Link
            to="/admin/payments"
            className={`admin-nav-link ${location.pathname === '/admin/payments' ? 'active' : ''}`}
          >
            <CreditCard size={15} /> Payments & Revenue
          </Link>
          <Link
            to="/admin/analytics"
            className={`admin-nav-link ${location.pathname === '/admin/analytics' ? 'active' : ''}`}
          >
            <BarChart3 size={15} /> Analytics
          </Link>
        </nav>

        {/* Right Logout */}
        <div className="d-flex align-items-center gap-3">
          {adminUser && (
            <span className="text-secondary small d-none d-md-inline">
              👤 {adminUser.email}
            </span>
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-danger rounded-pill px-3 py-1 d-flex align-items-center gap-1 fw-bold"
            onClick={handleLogout}
          >
            <LogOut size={14} /> Exit Admin
          </button>
        </div>
      </div>
    </header>
  );
}
