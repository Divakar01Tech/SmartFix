import { Shield, CheckCircle2, Clock } from 'lucide-react';
import './Terms.css';

const Terms = () => {
  return (
    <div className="terms-page">
      <section className="terms-hero">
        <div className="container text-center">
          <span className="terms-badge">LEGAL AGREEMENT</span>
          <h1>Terms & Conditions</h1>
          <p className="terms-hero-sub">Effective Date: January 1, 2026 • Version 2.4</p>
        </div>
      </section>

      <div className="container terms-content">
        <div className="terms-card">
          <div className="terms-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using the SmartFix platform, website, or mobile applications, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not access or use the platform.
            </p>
          </div>

          <div className="terms-section">
            <h2>2. Description of Platform & Services</h2>
            <p>
              SmartFix operates an online marketplace connecting homeowners and property managers ("Customers") with independent local repair technicians, plumbers, electricians, painters, and handymen ("Service Professionals"). SmartFix facilitates scheduling, real-time dispatch, communication, and secure payment processing.
            </p>
          </div>

          <div className="terms-section">
            <h2>3. Service Professional Verification & Independence</h2>
            <p>
              Service Professionals registered on SmartFix are independent contractors, not employees or partners of SmartFix. While SmartFix performs background identity checks (Aadhaar verification) and skill assessments, Customers are encouraged to verify job specs prior to work commencement.
            </p>
          </div>

          <div className="terms-section">
            <h2>4. Pricing, Estimates, and Payments</h2>
            <ul>
              <li>Service Professionals set their own hourly or per-job rates as displayed on their public profiles.</li>
              <li>Final payment is calculated based on actual time elapsed and any pre-approved material costs.</li>
              <li>Payments are processed securely via integrated gateways (UPI, Cards, Cash). SmartFix maintains zero tolerance for unauthorized off-platform extortion.</li>
            </ul>
          </div>

          <div className="terms-section">
            <h2>5. Cancellations & Rescheduling</h2>
            <p>
              Customers may cancel or reschedule any booking without penalty up to 1 hour prior to the scheduled start time. Cancellations made less than 30 minutes before arrival may incur a nominal \$5/₹200 technician travel fee.
            </p>
          </div>

          <div className="terms-section">
            <h2>6. Guarantee & Damage Protection Policy</h2>
            <p>
              All completed bookings are backed by the SmartFix Property Guarantee (up to ₹50,000). Claims must be submitted within 72 hours of job completion via support@smartfix.com.
            </p>
          </div>

          <div className="terms-section">
            <h2>7. Contact & Dispute Resolution</h2>
            <p>
              For questions regarding these Terms or formal legal notices, contact our Legal Affairs Department at legal@smartfix.com.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
