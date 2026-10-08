import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, HelpCircle, ShieldCheck, CreditCard, Calendar, ChevronDown, ChevronUp, MessageSquare, PhoneCall } from 'lucide-react';
import './HelpCenter.css';

const FAQ_DATA = [
  {
    category: 'Bookings & Scheduling',
    items: [
      {
        q: 'How do I book a handyman on SmartFix?',
        a: 'Search for your required service (e.g. Plumber, Electrician) on the homepage or Browse page. Select a handyman based on ratings and hourly rates, choose your preferred time slot, and click "Book Now".',
      },
      {
        q: 'Can I reschedule or cancel a booking?',
        a: 'Yes! You can reschedule or cancel any booking up to 1 hour before the scheduled arrival time directly from your Customer Dashboard without any cancellation fee.',
      },
      {
        q: 'What if the handyman arrives late?',
        a: 'Our handymen maintain a 98% on-time arrival record. If your professional is delayed by more than 15 minutes, you will receive a \$10 discount credit automatically.',
      },
    ],
  },
  {
    category: 'Pricing & Payments',
    items: [
      {
        q: 'How are handyman prices determined?',
        a: 'Handymen set their own transparent hourly rates listed on their profile. You are only charged for the exact time spent plus any replacement parts required (with prior approval).',
      },
      {
        q: 'What payment methods do you support?',
        a: 'SmartFix supports all major Indian payment options including UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, and Cash after service completion.',
      },
      {
        q: 'Is there any advance deposit required?',
        a: 'No upfront deposit is required for standard repair jobs under ₹2,000. For large structural/renovation jobs, a partial milestone deposit may be agreed upon.',
      },
    ],
  },
  {
    category: 'Safety & Verification',
    items: [
      {
        q: 'How are handymen background checked?',
        a: 'Every professional on SmartFix must submit government ID (Driving License/PAN), undergo police verification background check, and pass our technical skill review.',
      },
      {
        q: 'What if something gets damaged during repair?',
        a: 'Every SmartFix job is covered under our ₹50,000 Property Damage Guarantee. If accidental damage occurs during the repair, our claims team will handle repair or reimbursement.',
      },
    ],
  },
];

const HelpCenter = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openItems, setOpenItems] = useState({ 'Bookings & Scheduling-0': true });

  const toggleItem = (catIndex, itemIndex) => {
    const key = `${catIndex}-${itemIndex}`;
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="help-page">
      {/* Hero */}
      <section className="help-hero">
        <div className="container text-center">
          <span className="help-badge">SUPPORT & FAQ</span>
          <h1>How Can We Help You Today?</h1>

          <div className="help-search-box">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search help topics (e.g. cancellation, payment, refund)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Category Shortcuts */}
      <div className="container help-categories-grid">
        <div className="category-card">
          <Calendar size={28} color="#2563eb" />
          <h3>Bookings & Schedule</h3>
          <p>Reschedule, cancel, or modify repair visits</p>
        </div>
        <div className="category-card">
          <CreditCard size={28} color="#10b981" />
          <h3>Pricing & Payments</h3>
          <p>Invoices, UPI payments, receipts, and pricing</p>
        </div>
        <div className="category-card">
          <ShieldCheck size={28} color="#f59e0b" />
          <h3>Safety & Guarantee</h3>
          <p>Verification policies and damage protection</p>
        </div>
      </div>

      {/* FAQ Accordion */}
      <section className="container help-faq-section">
        <h2>Frequently Asked Questions</h2>

        <div className="faq-categories">
          {FAQ_DATA.map((cat) => (
            <div key={cat.category} className="faq-category-block">
              <h3>{cat.category}</h3>

              <div className="accordion-list">
                {cat.items
                  .filter((item) =>
                    searchTerm
                      ? item.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.a.toLowerCase().includes(searchTerm.toLowerCase())
                      : true
                  )
                  .map((item, idx) => {
                    const key = `${cat.category}-${idx}`;
                    const isOpen = !!openItems[key];
                    return (
                      <div key={idx} className={`accordion-item ${isOpen ? 'open' : ''}`}>
                        <button
                          type="button"
                          className="accordion-header"
                          onClick={() => toggleItem(cat.category, idx)}
                        >
                          <span>{item.q}</span>
                          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        {isOpen && <div className="accordion-body">{item.a}</div>}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Still Need Help Banner */}
      <section className="container help-contact-banner">
        <div className="hcb-card">
          <div className="hcb-text">
            <h2>Still Have Questions?</h2>
            <p>Can't find the answer you're looking for? Reach out directly to our customer happiness team.</p>
          </div>
          <div className="hcb-btns">
            <Link to="/contact" className="btn-primary">
              <MessageSquare size={16} /> Contact Support
            </Link>
            <a href="tel:18004257627" className="btn-secondary">
              <PhoneCall size={16} /> 1800-425-7627
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HelpCenter;
