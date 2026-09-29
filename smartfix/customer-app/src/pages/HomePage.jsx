import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Wrench, Zap, Droplets, Wind, Refrigerator, WashingMachine,
  Paintbrush, TreePine, SprayCan, Settings, ChevronRight,
  Star, Shield, Clock, MapPin
} from 'lucide-react';
import './HomePage.css';

const SERVICE_CATEGORIES = [
  { id: 'plumbing',         label: 'Plumbing',             icon: Droplets,       color: '#3B82F6', bg: '#EFF6FF', desc: 'Leak repairs, pipe fitting, drainage' },
  { id: 'electrical',       label: 'Electrical',           icon: Zap,            color: '#F59E0B', bg: '#FFFBEB', desc: 'Wiring, switches, circuit breakers' },
  { id: 'ac-service',       label: 'AC Service & Repair',  icon: Wind,           color: '#06B6D4', bg: '#ECFEFF', desc: 'Installation, cleaning, gas refill' },
  { id: 'refrigerator',     label: 'Refrigerator Repair',  icon: Refrigerator,   color: '#8B5CF6', bg: '#F5F3FF', desc: 'Cooling issues, compressor, gas' },
  { id: 'washing-machine',  label: 'Washing Machine',      icon: WashingMachine, color: '#EC4899', bg: '#FDF2F8', desc: 'Drum repair, motor, drainage pump' },
  { id: 'carpentry',        label: 'Carpentry',            icon: Wrench,         color: '#D97706', bg: '#FFFBEB', desc: 'Furniture repair, doors, cabinets' },
  { id: 'painting',         label: 'Painting',             icon: Paintbrush,     color: '#EF4444', bg: '#FEF2F2', desc: 'Interior, exterior, waterproofing' },
  { id: 'cleaning',         label: 'Cleaning',             icon: SprayCan,       color: '#10B981', bg: '#F0FDF4', desc: 'Deep clean, sofa, bathroom, kitchen' },
  { id: 'gardening',        label: 'Gardening',            icon: TreePine,       color: '#16A34A', bg: '#F0FDF4', desc: 'Pruning, planting, lawn care' },
  { id: 'general',          label: 'General Repair',       icon: Settings,       color: '#64748B', bg: '#F8FAFC', desc: 'Handyman tasks, misc fixes' },
];

const STATS = [
  { label: 'Verified Pros', value: '5,000+', icon: Shield },
  { label: 'Happy Customers', value: '50K+', icon: Star },
  { label: 'Avg Response', value: '< 10 min', icon: Clock },
  { label: 'Cities Served', value: '25+', icon: MapPin },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="home-page">
      {/* ── Hero ──────────────────────────── */}
      <section className="hero">
        <div className="hero-bg-blob blob-1" />
        <div className="hero-bg-blob blob-2" />
        <div className="hero-content">
          <div className="hero-badge">
            <Zap size={14} fill="#FF6B35" color="#FF6B35" />
            <span>Instant home service booking</span>
          </div>
          <h1 className="hero-title">
            Your home, taken<br />
            care of <span className="gradient-text">instantly</span>
          </h1>
          <p className="hero-sub">
            Book verified professionals for any home service.<br />
            Real-time tracking, transparent pricing, guaranteed quality.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={() => document.getElementById('services').scrollIntoView({ behavior: 'smooth' })}>
              Book a Service <ChevronRight size={20} />
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => navigate('/dashboard')}>
              My Bookings
            </button>
          </div>
        </div>
        <div className="hero-illustration">
          <div className="hero-card-float card-1">
            <Shield size={20} color="#10B981" />
            <span>Verified Pro</span>
          </div>
          <div className="hero-circle">
            <div className="hero-circle-inner">
              <Wrench size={48} color="#FF6B35" />
            </div>
          </div>
          <div className="hero-card-float card-2">
            <Star size={20} color="#F59E0B" fill="#F59E0B" />
            <span>4.9 Rating</span>
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────── */}
      <section className="stats-strip">
        {STATS.map(({ label, value, icon: Icon }) => (
          <div className="stat-item" key={label}>
            <Icon size={22} color="#FF6B35" />
            <div>
              <div className="stat-value">{value}</div>
              <div className="stat-label">{label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Service Grid ──────────────────── */}
      <section id="services" className="services-section">
        <div className="section-header">
          <h2 className="section-title">What do you need?</h2>
          <p className="section-sub">Choose a service and get connected instantly</p>
        </div>
        <div className="services-grid">
          {SERVICE_CATEGORIES.map(({ id, label, icon: Icon, color, bg, desc }) => (
            <button
              key={id}
              className="service-card"
              onClick={() => navigate(`/book/${id}`)}
              style={{ '--card-color': color, '--card-bg': bg }}
            >
              <div className="service-icon-wrap">
                <Icon size={28} color={color} />
              </div>
              <div className="service-info">
                <span className="service-name">{label}</span>
                <span className="service-desc">{desc}</span>
              </div>
              <ChevronRight size={18} color={color} className="service-arrow" />
            </button>
          ))}
        </div>
      </section>

      {/* ── How It Works ──────────────────── */}
      <section className="how-section">
        <h2 className="section-title text-center">How HandyBook Works</h2>
        <div className="steps-row">
          {[
            { num: '01', title: 'Choose Service', desc: 'Pick from 10+ home service categories' },
            { num: '02', title: 'Book Instantly', desc: 'Set your location & confirm booking' },
            { num: '03', title: 'Track Live', desc: 'Watch your pro arrive in real-time' },
            { num: '04', title: 'Pay Securely', desc: 'Pay online & earn cashback rewards' },
          ].map(({ num, title, desc }) => (
            <div className="how-step" key={num}>
              <div className="step-number">{num}</div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
