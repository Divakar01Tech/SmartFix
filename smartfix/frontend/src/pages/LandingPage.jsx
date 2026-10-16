import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Wrench, User, ShieldCheck, ArrowRight, Sparkles, MapPin, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import './LandingPage.css';

export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="landing-page-wrapper">
      {/* Top Brand Bar */}
      <header className="landing-header container d-flex justify-content-between align-items-center py-3">
        <div className="landing-brand d-flex align-items-center gap-2">
          <div className="landing-logo-box">
            <Wrench size={22} color="#ffffff" />
          </div>
          <span className="landing-brand-text">
            Smart<strong>Fix</strong>
          </span>
          <span className="badge bg-primary-subtle text-primary border rounded-pill px-2 py-1 ms-2" style={{ fontSize: '0.72rem' }}>
            Sivagangai District
          </span>
        </div>
        <Link to="/customer/experts" className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold">
          Explore Public Services
        </Link>
      </header>

      {/* Hero Section */}
      <section className="landing-hero container text-center py-5">
        <div className="d-inline-flex align-items-center gap-2 badge bg-warning-subtle text-warning-emphasis border border-warning rounded-pill px-3 py-2 mb-3 shadow-xs">
          <Sparkles size={14} /> Sivagangai District's Trusted Service & Dispatch Network
        </div>
        <h1 className="landing-title display-5 fw-extrabold text-dark mb-3">
          On-Demand Home Services & Technician Network
        </h1>
        <p className="landing-subtitle text-secondary mx-auto mb-5" style={{ maxWidth: '640px' }}>
          Select your portal to continue. Customer and Service Provider portals are fully isolated for complete session security and role-specific workflows.
        </p>

        {/* Two Role Chooser Cards */}
        <div className="row g-4 justify-content-center role-cards-row">
          {/* 1. Customer Portal Card */}
          <div className="col-12 col-md-6 col-lg-5">
            <div className="card role-portal-card customer-card h-100 p-4 border-0 shadow-sm rounded-4">
              <div className="role-card-badge customer-badge">
                <User size={24} />
              </div>
              <h3 className="fw-bold text-dark mb-2">I Need a Service</h3>
              <p className="text-secondary small mb-4">
                Book verified plumbers, electricians, AC technicians and appliance specialists at your doorstep in Sivagangai.
              </p>
              <ul className="role-features list-unstyled text-start mb-4">
                <li className="d-flex align-items-center gap-2 mb-2">
                  <CheckCircle2 size={16} className="text-primary" /> Upfront, transparent service pricing
                </li>
                <li className="d-flex align-items-center gap-2 mb-2">
                  <CheckCircle2 size={16} className="text-primary" /> Live GPS technician arrival tracking
                </li>
                <li className="d-flex align-items-center gap-2">
                  <CheckCircle2 size={16} className="text-primary" /> Secure payments & verified local handymen
                </li>
              </ul>
              <div className="mt-auto">
                <Link to="/customer/login" className="btn btn-primary btn-lg w-100 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm mb-2">
                  Enter Customer Portal <ArrowRight size={18} />
                </Link>
                <div className="text-muted small">
                  New to SmartFix? <Link to="/customer/register" className="text-primary fw-bold">Create Account</Link>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Worker / Provider Card */}
          <div className="col-12 col-md-6 col-lg-5">
            <div className="card role-portal-card worker-card h-100 p-4 border-0 shadow-sm rounded-4">
              <div className="role-card-badge worker-badge">
                <Wrench size={24} />
              </div>
              <h3 className="fw-bold text-dark mb-2">I am a Service Provider</h3>
              <p className="text-secondary small mb-4">
                Join our network of skilled technicians in Sivagangai. Receive nearby repair requests and earn daily income.
              </p>
              <ul className="role-features list-unstyled text-start mb-4">
                <li className="d-flex align-items-center gap-2 mb-2">
                  <CheckCircle2 size={16} className="text-warning" /> Daily local repair bookings & dispatch
                </li>
                <li className="d-flex align-items-center gap-2 mb-2">
                  <CheckCircle2 size={16} className="text-warning" /> Direct UPI bank payouts & transparent earnings
                </li>
                <li className="d-flex align-items-center gap-2">
                  <CheckCircle2 size={16} className="text-warning" /> Verified technician badge & AI interview approval
                </li>
              </ul>
              <div className="mt-auto">
                <Link to="/worker/login" className="btn btn-dark btn-lg w-100 rounded-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-sm mb-2" style={{ background: '#0f172a', borderColor: '#0f172a' }}>
                  Enter Partner Portal <ArrowRight size={18} />
                </Link>
                <div className="text-muted small">
                  New Technician? <Link to="/worker/register" className="text-warning fw-bold text-decoration-none">Apply as Partner</Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Discreet Admin Link */}
        <div className="text-center mt-5 pt-3">
          <Link to="/admin/login" className="admin-portal-link d-inline-flex align-items-center gap-1 text-muted small">
            <Lock size={13} /> Administration Console Access
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer py-4 border-top mt-5">
        <div className="container text-center text-muted small">
          <p className="mb-0">© {new Date().getFullYear()} SmartFix Sivagangai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
