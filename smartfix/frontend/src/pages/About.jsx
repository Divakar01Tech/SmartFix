import { Link } from 'react-router-dom';
import { ShieldCheck, Clock, Award, Users, Wrench, CheckCircle2, ArrowRight, HeartHandshake, Sparkles, MapPin } from 'lucide-react';
import './About.css';

const About = () => {
  return (
    <div className="about-page animate-fade-in-up">
      {/* Hero Section */}
      <section className="about-hero text-center py-5 bg-dark text-white position-relative overflow-hidden" style={{ borderRadius: '0 0 32px 32px' }}>
        <div className="container py-3">
          <span className="badge bg-warning text-dark fw-bold px-3 py-2 rounded-pill mb-3">
            <Sparkles size={14} /> ABOUT SMARTFIX
          </span>
          <h1 className="display-4 fw-extrabold mb-3">Revolutionizing Local Home Maintenance</h1>
          <p className="lead text-light opacity-90 max-w-2xl mx-auto mb-4">
            SmartFix connects homeowners in Tamil Nadu district with verified, background-checked, top-rated local handymen — bringing speed, traditional trust, and transparent pricing to everyday repairs.
          </p>
          <div className="d-flex justify-content-center gap-3 flex-wrap">
            <Link to="/browse" className="btn btn-primary btn-lg fw-bold rounded-4 px-4 py-3 shadow">
              Browse Repair Experts <ArrowRight size={18} />
            </Link>
            <Link to="/contact" className="btn btn-outline-light btn-lg fw-bold rounded-4 px-4 py-3">
              Contact Our Team
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Counter Grid */}
      <section className="container py-5">
        <div className="row g-4 text-center">
          <div className="col-6 col-md-3">
            <div className="card h-100 border-0 shadow-sm rounded-4 p-4 hover-lift">
              <h2 className="display-5 fw-extrabold text-primary mb-1">15,000+</h2>
              <h6 className="fw-bold text-dark mb-1">Repairs Solved</h6>
              <p className="text-muted small mb-0">Plumbing, electrical & AC fixes</p>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card h-100 border-0 shadow-sm rounded-4 p-4 hover-lift">
              <h2 className="display-5 fw-extrabold text-success mb-1">100%</h2>
              <h6 className="fw-bold text-dark mb-1">Verified Pros</h6>
              <p className="text-muted small mb-0">Mobile & identity checked</p>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card h-100 border-0 shadow-sm rounded-4 p-4 hover-lift">
              <h2 className="display-5 fw-extrabold text-warning mb-1">4.9 / 5</h2>
              <h6 className="fw-bold text-dark mb-1">User Rating</h6>
              <p className="text-muted small mb-0">Based on 8,500+ reviews</p>
            </div>
          </div>

          <div className="col-6 col-md-3">
            <div className="card h-100 border-0 shadow-sm rounded-4 p-4 hover-lift">
              <h2 className="display-5 fw-extrabold text-info mb-1">8+ Towns</h2>
              <h6 className="fw-bold text-dark mb-1">District Coverage</h6>
              <p className="text-muted small mb-0">Tamil Nadu, Karaikudi & all taluks</p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Story Section */}
      <section className="bg-white py-5 border-top border-bottom">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <span className="badge bg-primary-subtle text-primary fw-bold px-3 py-2 rounded-pill mb-2">OUR MISSION</span>
              <h2 className="display-6 fw-extrabold mb-3">Traditional Trust Meets Modern Speed</h2>
              <p className="text-secondary lead mb-3">
                SmartFix was created to eliminate the daily hassle of finding honest, punctual, skilled local handymen.
              </p>
              <p className="text-muted mb-4">
                We combine real-time GPS location matching with transparent hourly rates, instant 1-hour arrival guarantees, and direct phone/WhatsApp communication for every family in Tamil Nadu.
              </p>

              <ul className="list-unstyled d-flex flex-column gap-3 mb-0">
                <li className="d-flex align-items-center gap-3">
                  <CheckCircle2 color="#059669" size={24} />
                  <span><strong>1-Hour Arrival Guarantee:</strong> Technicians arrive within 60 mins of acceptance.</span>
                </li>
                <li className="d-flex align-items-center gap-3">
                  <CheckCircle2 color="#059669" size={24} />
                  <span><strong>100% Price Transparency:</strong> No hidden charges or surprise costs.</span>
                </li>
                <li className="d-flex align-items-center gap-3">
                  <CheckCircle2 color="#059669" size={24} />
                  <span><strong>Fair Worker Payouts:</strong> 90% share goes directly to local craftsmen.</span>
                </li>
              </ul>
            </div>

            <div className="col-lg-6">
              <div className="card border-0 shadow-lg rounded-5 p-4 p-lg-5 text-white bg-dark">
                <Wrench size={48} color="#f59e0b" className="mb-3" />
                <h3 className="fw-extrabold mb-2">The SmartFix Promise</h3>
                <p className="text-light opacity-90 fs-5 mb-4">&ldquo;Fast, Honest, Professional Repair Service Every Single Time.&rdquo;</p>
                <div className="d-flex flex-column gap-3 border-top border-secondary pt-3">
                  <div className="d-flex align-items-center gap-3">
                    <ShieldCheck size={24} color="#3b82f6" />
                    <div>
                      <strong className="d-block">Background Checked</strong>
                      <small className="text-light opacity-75">Mobile & identity verified workers</small>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-3">
                    <Clock size={24} color="#10b981" />
                    <div>
                      <strong className="d-block">On-Time Guarantee</strong>
                      <small className="text-light opacity-75">On-site within scheduled window</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container my-5">
        <div className="bg-primary text-white rounded-5 p-5 shadow-lg text-center">
          <h2 className="display-6 fw-extrabold mb-3">Ready to Experience SmartFix?</h2>
          <p className="lead opacity-90 mb-4">Book verified local experts or register as a master partner technician today.</p>
          <div className="d-flex justify-content-center gap-3 flex-wrap">
            <Link to="/browse" className="btn btn-warning btn-lg fw-bold rounded-4 px-4 py-3">
              Find a Local Expert Now 🚀
            </Link>
            <Link to="/login?tab=register" className="btn btn-outline-light btn-lg fw-bold rounded-4 px-4 py-3">
              Register as Service Pro 🛠️
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
