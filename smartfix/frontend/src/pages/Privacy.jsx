import { Lock } from 'lucide-react';
import './Privacy.css';

const Privacy = () => {
  return (
    <div className="privacy-page">
      <section className="privacy-hero">
        <div className="container text-center">
          <span className="privacy-badge">
            <Lock size={14} /> PRIVACY & DATA PROTECTION
          </span>
          <h1>Privacy Policy</h1>
          <p className="privacy-hero-sub">Effective Date: January 1, 2026 • Your Privacy Matters</p>
        </div>
      </section>

      <div className="container privacy-content">
        <div className="privacy-card">
          <div className="privacy-section">
            <h2>1. Information We Collect</h2>
            <p>
              SmartFix collects information necessary to provide seamless home repair dispatch, including:
            </p>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, phone number, and service address.</li>
              <li><strong>Location Data:</strong> Geolocation coordinates when searching for nearby workers (only with explicit GPS permissions).</li>
              <li><strong>Service History & Messages:</strong> Booking requests, trade requirements, and in-app communications.</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>2. How We Use Your Information</h2>
            <p>We strictly use collected information to:</p>
            <ul>
              <li>Connect homeowners with the closest qualified repair professionals.</li>
              <li>Process payments and issue digital receipts.</li>
              <li>Send real-time SMS updates regarding handyman arrival and job status.</li>
              <li>Improve platform performance and prevent fraudulent activity.</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h2>3. Information Sharing & Third Parties</h2>
            <p>
              We do <strong>NOT</strong> sell, rent, or trade your personal data to third-party advertisers. Limited service location details are shared only with the assigned handyman for job completion.
            </p>
          </div>

          <div className="privacy-section">
            <h2>4. Security & Encryption</h2>
            <p>
              All sensitive communications and payment details are protected using industry-standard SSL 256-bit encryption. Payment credentials are directly processed by PCI-DSS compliant payment gateways.
            </p>
          </div>

          <div className="privacy-section">
            <h2>5. Your Rights & Data Deletion</h2>
            <p>
              You have the right to inspect, update, or request permanent deletion of your account data at any time by emailing privacy@smartfix.com.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
