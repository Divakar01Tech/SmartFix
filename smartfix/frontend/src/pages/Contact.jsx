import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, Send, MessageSquare, CheckCircle2, HelpCircle } from 'lucide-react';
import './Contact.css';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.message) {
      setSubmitted(true);
    }
  };

  return (
    <div className="contact-page">
      {/* Header */}
      <section className="contact-hero">
        <div className="container text-center">
          <span className="contact-badge">
            <MessageSquare size={14} /> GET IN TOUCH
          </span>
          <h1>We'd Love to Hear From You</h1>
          <p className="contact-hero-sub">
            Have questions about booking a handyman, service rates, or becoming a partner? Our support team is here 24/7.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <div className="container contact-main-grid">
        {/* Contact Info Sidebar */}
        <div className="contact-info-card">
          <h2>Contact Information</h2>
          <p className="info-desc">Reach out to us directly or fill in the form and we'll get back to you within 2 hours.</p>

          <div className="info-list">
            <div className="info-item">
              <div className="info-icon-box"><Phone size={20} /></div>
              <div>
                <strong>Customer Support Hotline</strong>
                <p>+91 (800) 555-FIXIT / 1800-425-7627</p>
                <small>Mon - Sun: 7:00 AM - 10:00 PM</small>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon-box"><Mail size={20} /></div>
              <div>
                <strong>Email Us</strong>
                <p>support@smartfix.com</p>
                <p>partners@smartfix.com</p>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon-box"><MapPin size={20} /></div>
              <div>
                <strong>Headquarters Location</strong>
                <p>SmartFix Complex, 2nd Floor</p>
                <p>Collectorate Road, Tamil Nadu - 630561, Tamil Nadu</p>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon-box"><Clock size={20} /></div>
              <div>
                <strong>24/7 Emergency Dispatch</strong>
                <p>Emergency Plumber & Electrician Line Active 24/7</p>
              </div>
            </div>
          </div>

          <div className="support-guarantee-box">
            <HelpCircle size={22} className="guarantee-icon" />
            <div>
              <strong>Instant Resolution Guarantee</strong>
              <p>For urgent ongoing bookings, call our direct priority line above.</p>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="contact-form-card">
          {submitted ? (
            <div className="contact-success-state">
              <CheckCircle2 size={56} color="#10b981" />
              <h2>Message Sent Successfully!</h2>
              <p>Thank you, <strong>{formData.name}</strong>. A SmartFix customer specialist has received your inquiry and will contact you at <strong>{formData.email}</strong> shortly.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setSubmitted(false);
                  setFormData({ name: '', email: '', phone: '', subject: 'General Inquiry', message: '' });
                }}
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="contact-form">
              <h2>Send Us a Message</h2>
              <p className="form-sub">Fill out the details below and we will respond promptly.</p>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Your Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder="e.g. Divakar"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="name@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Subject *</label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Booking Help">Booking & Scheduling Help</option>
                    <option value="Worker Registration">Handyman Partnership</option>
                    <option value="Billing Issue">Payment or Billing Issue</option>
                    <option value="Feedback">Feedback & Suggestions</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="message">Your Message *</label>
                <textarea
                  id="message"
                  name="message"
                  rows="5"
                  placeholder="How can we help you today? Please describe your request..."
                  value={formData.message}
                  onChange={handleChange}
                  required
                ></textarea>
              </div>

              <button type="submit" className="btn-primary form-submit-btn">
                Send Message <Send size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contact;
