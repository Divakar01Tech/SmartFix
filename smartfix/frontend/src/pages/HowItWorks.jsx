import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, CalendarCheck, Wrench, ShieldCheck, UserPlus, Briefcase, DollarSign, ArrowRight, CheckCircle2, Navigation, Clock, Sparkles } from 'lucide-react';
import './HowItWorks.css';

const HowItWorks = () => {
  const [activeTab, setActiveTab] = useState('customers');

  return (
    <div className="how-page animate-fade-in-up">
      {/* Hero Section */}
      <section className="how-hero text-center py-5 bg-dark text-white position-relative overflow-hidden" style={{ borderRadius: '0 0 32px 32px' }}>
        <div className="container py-3">
          <span className="badge bg-warning text-dark fw-bold px-3 py-2 rounded-pill mb-3">
            <Sparkles size={14} /> SIMPLE & TRANSPARENT PROCESS
          </span>
          <h1 className="display-4 fw-extrabold mb-3">How SmartFix Works</h1>
          <p className="lead text-light opacity-90 max-w-2xl mx-auto mb-4">
            Whether you need emergency home repairs or want to list your skills as a master technician, SmartFix makes local service booking fast, traditional, and trustworthy.
          </p>

          {/* Bootstrap Pill Tabs */}
          <div className="d-inline-flex bg-white-10 p-1 rounded-pill border border-secondary">
            <button
              type="button"
              className={`btn rounded-pill px-4 py-2 fw-bold ${activeTab === 'customers' ? 'btn-primary shadow' : 'text-white'}`}
              onClick={() => setActiveTab('customers')}
            >
              👨‍👩‍👧 For Homeowners & Users
            </button>
            <button
              type="button"
              className={`btn rounded-pill px-4 py-2 fw-bold ${activeTab === 'workers' ? 'btn-success shadow' : 'text-white'}`}
              onClick={() => setActiveTab('workers')}
            >
              🛠️ For Handymen & Service Pros
            </button>
          </div>
        </div>
      </section>

      {/* Steps Content */}
      <div className="container py-5">
        {activeTab === 'customers' ? (
          <div className="row g-4">
            <div className="col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center transition-all hover-lift border-top border-4 border-primary">
                <div className="fs-3 fw-bold text-primary mb-2">01</div>
                <div className="bg-primary-subtle p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64 }}>
                  <Search size={30} className="text-primary" />
                </div>
                <h4 className="fw-bold mb-2">1. Search & Filter</h4>
                <p className="text-muted fs-6">Select your trade (plumbing, electrical, AC, etc.), view verified local technicians, and check upfront hourly rates.</p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center transition-all hover-lift border-top border-4 border-success">
                <div className="fs-3 fw-bold text-success mb-2">02</div>
                <div className="bg-success-subtle p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64 }}>
                  <Navigation size={30} className="text-success" />
                </div>
                <h4 className="fw-bold mb-2">2. Radial GPS Match</h4>
                <p className="text-muted fs-6">Detect your live GPS position. Our algorithm dispatches your request to nearest pros within a 5 km radius.</p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center transition-all hover-lift border-top border-4 border-warning">
                <div className="fs-3 fw-bold text-warning mb-2">03</div>
                <div className="bg-warning-subtle p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64 }}>
                  <Clock size={30} className="text-warning-emphasis" />
                </div>
                <h4 className="fw-bold mb-2">3. 1-Hour Arrival</h4>
                <p className="text-muted fs-6">Your verified handyman arrives at your doorstep within 60 minutes equipped with proper tools & verified ID.</p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center transition-all hover-lift border-top border-4 border-purple" style={{ borderTopColor: '#9333ea' }}>
                <div className="fs-3 fw-bold text-purple mb-2" style={{ color: '#9333ea' }}>04</div>
                <div className="p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64, background: '#f3e8ff' }}>
                  <ShieldCheck size={30} color="#9333ea" />
                </div>
                <h4 className="fw-bold mb-2">4. Pay Safely & Rate</h4>
                <p className="text-muted fs-6">Pay easily via UPI, Cash, or Card. Rate your handyman to maintain high community service standards.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="row g-4">
            <div className="col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center transition-all hover-lift border-top border-4 border-primary">
                <div className="fs-3 fw-bold text-primary mb-2">01</div>
                <div className="bg-primary-subtle p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64 }}>
                  <UserPlus size={30} className="text-primary" />
                </div>
                <h4 className="fw-bold mb-2">1. Register Profile</h4>
                <p className="text-muted fs-6">Create your pro partner account in 3 minutes. Add your trade skills, location, and hourly service rates.</p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center transition-all hover-lift border-top border-4 border-success">
                <div className="fs-3 fw-bold text-success mb-2">02</div>
                <div className="bg-success-subtle p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64 }}>
                  <Briefcase size={30} className="text-success" />
                </div>
                <h4 className="fw-bold mb-2">2. Radial Job Alerts</h4>
                <p className="text-muted fs-6">Receive real-time 30-second popup dispatch requests whenever homeowners in your town request your skills.</p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center transition-all hover-lift border-top border-4 border-warning">
                <div className="fs-3 fw-bold text-warning mb-2">03</div>
                <div className="bg-warning-subtle p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64 }}>
                  <Wrench size={30} className="text-warning-emphasis" />
                </div>
                <h4 className="fw-bold mb-2">3. Complete Job</h4>
                <p className="text-muted fs-6">Accept tickets that fit your schedule. Use in-app GPS navigation to reach the customer location.</p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="card h-100 border-0 shadow-sm rounded-4 p-4 text-center transition-all hover-lift border-top border-4 border-success">
                <div className="fs-3 fw-bold text-success mb-2">04</div>
                <div className="bg-success-subtle p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: 64, height: 64 }}>
                  <DollarSign size={30} className="text-success" />
                </div>
                <h4 className="fw-bold mb-2">4. Direct Payout</h4>
                <p className="text-muted fs-6">Receive 90% net earnings in your wallet with 0% platform fee on your first 10 jobs. Withdraw to UPI/Bank instantly!</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guarantee Section */}
      <section className="container mb-5">
        <div className="card border-0 shadow-lg rounded-5 p-4 p-lg-5 bg-gradient text-white text-center" style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
          <div className="max-w-2xl mx-auto">
            <h2 className="display-6 fw-extrabold mb-3">Protected by SmartFix Quality Assurance</h2>
            <p className="lead opacity-90 mb-4">
              We stand behind every repair with our 100% satisfaction guarantee. If an issue is not fixed to your satisfaction, we will send another expert or refund your payment in full.
            </p>
            <Link to="/browse" className="btn btn-light btn-lg fw-bold rounded-4 px-4 py-3 text-success shadow">
              Find Your Verified Handyman Now <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
