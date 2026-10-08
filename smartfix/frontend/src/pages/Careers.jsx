import { useState } from 'react';
import { Briefcase, MapPin, Clock, ArrowRight, CheckCircle2, Heart, Rocket, Shield, Users, Send } from 'lucide-react';
import './Careers.css';

const JOB_OPENINGS = [
  {
    id: 1,
    title: 'Senior Full-Stack React Engineer',
    department: 'Engineering',
    location: 'Tamil Nadu (Hybrid)',
    type: 'Full-Time',
    experience: '3-5 Years',
    desc: 'Build next-generation real-time dispatch systems and customer mobile web interfaces using React, Node.js, and MongoDB.',
  },
  {
    id: 2,
    title: 'District Operations Manager',
    department: 'Operations',
    location: 'Karaikudi / Tamil Nadu',
    type: 'Full-Time',
    experience: '2-4 Years',
    desc: 'Oversee handyman onboarding, verification operations, quality audits, and growth across Tamil Nadu towns.',
  },
  {
    id: 3,
    title: 'Customer Success & Support Specialist',
    department: 'Support',
    location: 'Tamil Nadu (On-Site)',
    type: 'Full-Time',
    experience: '1-3 Years',
    desc: 'Provide world-class dispute resolution, live phone & chat assistance for homeowners and service providers.',
  },
  {
    id: 4,
    title: 'Digital Marketing & Growth Lead',
    department: 'Marketing',
    location: 'Remote (India)',
    type: 'Full-Time',
    experience: '3+ Years',
    desc: 'Drive organic acquisition, localized SEO, performance ads, and worker brand awareness across South India.',
  },
];

const Careers = () => {
  const [selectedJob, setSelectedJob] = useState(null);
  const [applied, setApplied] = useState(false);
  const [applicant, setApplicant] = useState({ name: '', email: '', phone: '', portfolio: '', coverLetter: '' });

  const handleApplySubmit = (e) => {
    e.preventDefault();
    setApplied(true);
  };

  return (
    <div className="careers-page">
      {/* Hero */}
      <section className="careers-hero">
        <div className="container text-center">
          <span className="careers-badge">JOIN OUR TEAM</span>
          <h1>Build the Future of Home Services</h1>
          <p className="careers-hero-sub">
            Join a passionate team of innovators, engineers, and operation leaders transforming how millions of households get their repairs done.
          </p>
        </div>
      </section>

      {/* Perks / Culture Section */}
      <section className="container careers-perks-section">
        <div className="section-header center">
          <span className="section-subtitle">WHY JOIN SMARTFIX</span>
          <h2>Benefits & Culture That Empower You</h2>
        </div>

        <div className="perks-grid">
          <div className="perk-card">
            <div className="perk-icon-wrap blue"><Rocket size={24} /></div>
            <h3>Fast Growth & Ownership</h3>
            <p>Work directly with founders, take ownership of high-impact features, and accelerate your career trajectory.</p>
          </div>
          <div className="perk-card">
            <div className="perk-icon-wrap green"><Heart size={24} /></div>
            <h3>Health & Wellness Cover</h3>
            <p>Comprehensive medical insurance for you and your family, plus wellness subsidies and paid time off.</p>
          </div>
          <div className="perk-card">
            <div className="perk-icon-wrap amber"><Shield size={24} /></div>
            <h3>Competitive Pay & Equity</h3>
            <p>Above-market base salary packages with performance bonuses and stock options in a fast-growing startup.</p>
          </div>
          <div className="perk-card">
            <div className="perk-icon-wrap purple"><Users size={24} /></div>
            <h3>Inclusive & Vibrant Team</h3>
            <p>Collaborative workplace culture built on transparency, mutual respect, continuous learning, and fun team outings.</p>
          </div>
        </div>
      </section>

      {/* Open Positions List */}
      <section className="container careers-jobs-section">
        <div className="section-header">
          <span className="section-subtitle">OPEN POSITIONS</span>
          <h2>Explore Available Opportunities ({JOB_OPENINGS.length})</h2>
        </div>

        <div className="jobs-list">
          {JOB_OPENINGS.map((job) => (
            <div key={job.id} className="job-card">
              <div className="job-info">
                <span className="job-dept">{job.department}</span>
                <h3>{job.title}</h3>
                <p className="job-desc">{job.desc}</p>
                <div className="job-meta">
                  <span><MapPin size={14} /> {job.location}</span>
                  <span><Clock size={14} /> {job.type}</span>
                  <span><Briefcase size={14} /> {job.experience}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn-primary job-apply-btn"
                onClick={() => {
                  setSelectedJob(job);
                  setApplied(false);
                }}
              >
                Apply Now <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Modal Application Form */}
      {selectedJob && (
        <div className="modal-backdrop" onClick={() => setSelectedJob(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="modal-close" onClick={() => setSelectedJob(null)}>×</button>

            {applied ? (
              <div className="modal-success">
                <CheckCircle2 size={56} color="#10b981" />
                <h2>Application Submitted!</h2>
                <p>Thank you for applying for <strong>{selectedJob.title}</strong>. Our talent team will review your application and get back to you within 3 business days.</p>
                <button type="button" className="btn-primary" onClick={() => setSelectedJob(null)}>Done</button>
              </div>
            ) : (
              <form onSubmit={handleApplySubmit} className="job-form">
                <h2>Apply for {selectedJob.title}</h2>
                <p className="modal-sub">{selectedJob.location} • {selectedJob.type}</p>

                <div className="form-group">
                  <label htmlFor="applicantName">Full Name *</label>
                  <input
                    type="text"
                    id="applicantName"
                    value={applicant.name}
                    onChange={(e) => setApplicant({ ...applicant, name: e.target.value })}
                    required
                    placeholder="e.g. Divakar Ramesh"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="applicantEmail">Email Address *</label>
                    <input
                      type="email"
                      id="applicantEmail"
                      value={applicant.email}
                      onChange={(e) => setApplicant({ ...applicant, email: e.target.value })}
                      required
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="applicantPhone">Phone Number *</label>
                    <input
                      type="tel"
                      id="applicantPhone"
                      value={applicant.phone}
                      onChange={(e) => setApplicant({ ...applicant, phone: e.target.value })}
                      required
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="applicantPortfolio">Resume / Portfolio / LinkedIn URL *</label>
                  <input
                    type="url"
                    id="applicantPortfolio"
                    value={applicant.portfolio}
                    onChange={(e) => setApplicant({ ...applicant, portfolio: e.target.value })}
                    required
                    placeholder="https://linkedin.com/in/username"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="applicantCover">Why do you want to join SmartFix?</label>
                  <textarea
                    id="applicantCover"
                    rows="3"
                    value={applicant.coverLetter}
                    onChange={(e) => setApplicant({ ...applicant, coverLetter: e.target.value })}
                    placeholder="Tell us briefly about your experience and background..."
                  ></textarea>
                </div>

                <button type="submit" className="btn-primary form-submit-btn">
                  Submit Application <Send size={16} />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Careers;
