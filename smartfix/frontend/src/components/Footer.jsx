import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, Mail, Phone, MapPin, ArrowRight, ShieldCheck, Heart } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import './Footer.css';

const Footer = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  return (
    <footer className="footer">
      {/* Top Banner / Newsletter */}
      <div className="footer-newsletter-wrap">
        <div className="container footer-newsletter-inner">
          <div className="newsletter-text">
            <ShieldCheck size={28} className="newsletter-icon" />
            <div>
              <h3>Subscribe for Exclusive Repairs & Offers</h3>
              <p>Get instant updates and service offers in Tamil Nadu.</p>
            </div>
          </div>
          <form className="newsletter-form" onSubmit={handleSubscribe}>
            {subscribed ? (
              <div className="newsletter-success">🎉 Thank you for subscribing! Check your inbox soon.</div>
            ) : (
              <>
                <input
                  type="email"
                  placeholder="Enter your email address..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" className="newsletter-btn">
                  Subscribe <ArrowRight size={16} />
                </button>
              </>
            )}
          </form>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="container footer-main">
        {/* Brand Column */}
        <div className="footer-col footer-brand-col">
          <Link to="/" className="footer-logo">
            <div className="logo-icon-box">
              <Wrench size={22} color="#ffffff" />
            </div>
            <span>Smart<strong>Fix</strong></span>
          </Link>
          <p className="footer-tagline">
            {t('footer_tagline')}
          </p>
          <div className="footer-contact-details">
            <div className="contact-item">
              <MapPin size={16} className="contact-icon" />
              <span>Tamil Nadu, Karaikudi & All Tamil Nadu Towns, Tamil Nadu</span>
            </div>
            <div className="contact-item">
              <Phone size={16} className="contact-icon" />
              <span>+91 (800) 555-FIXIT / 1800-425-7627</span>
            </div>
            <div className="contact-item">
              <Mail size={16} className="contact-icon" />
              <span>support@smartfix.com</span>
            </div>
          </div>
        </div>

        {/* Links Column 1: Company */}
        <div className="footer-col">
          <h4>{t('quick_links')}</h4>
          <ul className="footer-links">
            <li><Link to="/">{t('home')}</Link></li>
            <li><Link to="/about">{t('about')}</Link></li>
            <li><Link to="/careers">{t('careers')}</Link></li>
            <li><Link to="/contact">{t('contact_us')}</Link></li>
          </ul>
        </div>

        {/* Links Column 2: Popular Services */}
        <div className="footer-col">
          <h4>{t('services_title')}</h4>
          <ul className="footer-links">
            <li><Link to="/browse?category=Plumbing">{t('plumbing')}</Link></li>
            <li><Link to="/browse?category=Electrical">{t('electrical')}</Link></li>
            <li><Link to="/browse?category=AC Service">{t('ac_service')}</Link></li>
            <li><Link to="/browse?category=Washing Machine">{t('washing_machine')}</Link></li>
            <li><Link to="/browse?category=Water Purifier">{t('water_purifier')}</Link></li>
          </ul>
        </div>

        {/* Links Column 3: For Handymen */}
        <div className="footer-col">
          <h4>{t('for_workers_title')}</h4>
          <ul className="footer-links">
            <li><Link to="/login?tab=register">{t('join_partner_btn')}</Link></li>
            <li><Link to="/login">{t('login_register')}</Link></li>
          </ul>
        </div>

        {/* Links Column 4: Support & Legal */}
        <div className="footer-col">
          <h4>{t('contact_us')} & {t('privacy')}</h4>
          <ul className="footer-links">
            <li><Link to="/help">{t('help')}</Link></li>
            <li><Link to="/terms">{t('terms')}</Link></li>
            <li><Link to="/privacy">{t('privacy')}</Link></li>
          </ul>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className="footer-bottom-wrap">
        <div className="container footer-bottom-inner">
          <p>© {new Date().getFullYear()} SmartFix Technologies Inc. {t('all_rights_reserved')}</p>
          <p className="footer-crafted">
            Crafted with <Heart size={14} color="#ef4444" fill="#ef4444" style={{ display: 'inline', margin: '0 3px' }} /> for Tamil Nadu.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
