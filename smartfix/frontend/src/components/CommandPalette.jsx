import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Wrench, Navigation, Bookmark, Heart, Sun, Moon,
  Globe, ShieldAlert, Sparkles, User, Calendar, Wallet,
  CreditCard, HelpCircle, PhoneCall, ArrowRight, CornerDownLeft, Sliders
} from 'lucide-react';
import { useComfort } from '../context/ComfortContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { HOME_SERVICES } from '../data/servicesData';
import './CommandPalette.css';

export default function CommandPalette() {
  const navigate = useNavigate();
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setIsComfortModalOpen,
    setIsSavedModalOpen,
    favoriteWorkers,
  } = useComfort();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Focus input on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCommandPaletteOpen]);

  // Construct command list
  const allCommands = useMemo(() => {
    const list = [];


    list.push({
      id: 'action-saved',
      category: 'Quick Actions',
      title: `Saved Specialists (${favoriteWorkers.length})`,
      subtitle: 'View your favorite handymen for instant 1-click rebooking',
      icon: <Heart size={18} className="text-danger" />,
      badge: 'Alt + S',
      run: () => setIsSavedModalOpen(true),
    });

    list.push({
      id: 'action-theme',
      category: 'Quick Actions',
      title: theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode',
      subtitle: theme === 'light' ? 'Restful sleek dark theme' : 'Bright daylight theme',
      icon: theme === 'light' ? <Moon size={18} className="text-warning" /> : <Sun size={18} className="text-warning" />,
      badge: 'Theme',
      run: () => toggleTheme(),
    });

    list.push({
      id: 'action-lang',
      category: 'Quick Actions',
      title: language === 'en' ? 'தமிழில் மாற்றவும் (Switch to Tamil)' : 'Switch to English',
      subtitle: 'Change portal language for services and bookings',
      icon: <Globe size={18} className="text-info" />,
      badge: 'Language',
      run: () => setLanguage(language === 'en' ? 'ta' : 'en'),
    });

    list.push({
      id: 'action-sos',
      category: 'Quick Actions',
      title: 'Emergency SOS / 24x7 Helpline',
      subtitle: 'Direct emergency hotline for urgent electrical or water leak hazards',
      icon: <ShieldAlert size={18} className="text-danger" />,
      badge: 'Emergency',
      run: () => {
        navigate('/contact');
      },
    });

    // 2. Services & Repairs
    HOME_SERVICES.forEach((srv) => {
      list.push({
        id: `service-${srv.id}`,
        category: 'Services & Trades',
        title: srv.name,
        subtitle: `Starts from ₹${srv.startingPrice} • ${srv.desc || srv.description}`,
        icon: <span style={{ fontSize: '1.2rem' }}>{srv.icon}</span>,
        badge: 'Service',
        run: () => navigate(`/customer/experts?category=${encodeURIComponent(srv.name)}`),
      });

      // Sub-services
      (srv.subServices || []).forEach((sub) => {
        list.push({
          id: `sub-${srv.id}-${sub.replace(/\s+/g, '-').toLowerCase()}`,
          category: `${srv.name} Sub-Services`,
          title: sub,
          subtitle: `Specialized repair under ${srv.name}`,
          icon: <Wrench size={16} className="text-primary" />,
          badge: 'Sub-Service',
          run: () => navigate(`/customer/experts?category=${encodeURIComponent(srv.name)}&q=${encodeURIComponent(sub)}`),
        });
      });
    });

    // 3. Navigation Pages
    list.push({
      id: 'nav-dashboard',
      category: 'Navigation',
      title: 'Customer Dashboard',
      subtitle: 'View active bookings, dispatch tracking, and handyman scores',
      icon: <User size={18} className="text-success" />,
      badge: 'Page',
      run: () => navigate('/customer/home'),
    });

    list.push({
      id: 'nav-experts',
      category: 'Navigation',
      title: 'Browse Verified Experts',
      subtitle: 'Filter nearby specialists across Sivagangai District',
      icon: <Navigation size={18} className="text-primary" />,
      badge: 'Page',
      run: () => navigate('/customer/experts'),
    });

    list.push({
      id: 'nav-services',
      category: 'Navigation',
      title: 'All Services Catalog',
      subtitle: 'Browse all 6 core categories and transparent price list',
      icon: <Wrench size={18} className="text-warning" />,
      badge: 'Page',
      run: () => navigate('/customer/services'),
    });

    list.push({
      id: 'nav-bookings',
      category: 'Navigation',
      title: 'My Bookings & Repair History',
      subtitle: 'Check active job status, SLA countdown, and invoices',
      icon: <Calendar size={18} className="text-info" />,
      badge: 'Page',
      run: () => navigate('/customer/bookings'),
    });

    list.push({
      id: 'nav-wallet',
      category: 'Navigation',
      title: 'SmartFix Digital Wallet',
      subtitle: 'Top up funds, redeem bonus cashback & check balance',
      icon: <Wallet size={18} className="text-success" />,
      badge: 'Page',
      run: () => navigate('/customer/wallet'),
    });

    list.push({
      id: 'nav-payments',
      category: 'Navigation',
      title: 'Payment & Transaction History',
      subtitle: 'View Razorpay receipts and invoice downloads',
      icon: <CreditCard size={18} className="text-secondary" />,
      badge: 'Page',
      run: () => navigate('/customer/payments'),
    });

    list.push({
      id: 'nav-profile',
      category: 'Navigation',
      title: 'Profile Settings & Saved Addresses',
      subtitle: 'Manage default location, name, phone and notifications',
      icon: <User size={18} className="text-dark" />,
      badge: 'Page',
      run: () => navigate('/customer/profile'),
    });

    list.push({
      id: 'nav-help',
      category: 'Navigation',
      title: 'Help Center & FAQs',
      subtitle: 'Answers on booking, arrival times, and cancellations',
      icon: <HelpCircle size={18} className="text-muted" />,
      badge: 'Page',
      run: () => navigate('/help'),
    });

    // 4. Saved Favorites (if any)
    favoriteWorkers.forEach((w) => {
      list.push({
        id: `fav-worker-${w._id || w.id}`,
        category: 'My Saved Specialists',
        title: `${w.name || 'Specialist'} (${w.trade || 'Handyman'})`,
        subtitle: `⭐ ${w.rating || '5.0'} • ₹${w.ratePerHour}/hr • ${w.location || 'Sivagangai'}`,
        icon: <Heart size={16} className="text-danger fill-danger" style={{ fill: '#ef4444' }} />,
        badge: 'Rebook',
        run: () => navigate(`/customer/book/${w._id || w.id}`),
      });
    });

    return list;
  }, [theme, language, favoriteWorkers, navigate, setIsComfortModalOpen, setIsSavedModalOpen, setLanguage, toggleTheme]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Return top quick actions, top services, and saved specialists
      return allCommands.slice(0, 14);
    }
    return allCommands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.subtitle.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q)
    );
  }, [allCommands, query]);

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside list
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filteredCommands.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        executeCommand(filteredCommands[selectedIndex]);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('.command-item.selected');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const executeCommand = (cmd) => {
    setIsCommandPaletteOpen(false);
    if (cmd && typeof cmd.run === 'function') {
      cmd.run();
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      className="command-palette-backdrop animate-fade-in"
      onClick={() => setIsCommandPaletteOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="command-palette-modal animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="command-palette-header">
          <Search size={20} className="command-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder={language === 'ta' ? 'சேவை, பழுதுநீக்கம் அல்லது பக்கத்தைத் தேடுக... (எ.கா: குழாய், மின்சாரம், ஏசி)' : 'Type a command, service or repair... (e.g. AC leak, Plumber, Bookings)'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              type="button"
              className="command-clear-btn"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          )}
          <span className="command-kbd-badge">ESC</span>
        </div>

        {/* Results List */}
        <div className="command-palette-body" ref={listRef}>
          {filteredCommands.length === 0 ? (
            <div className="command-empty-state">
              <Sparkles size={32} className="text-muted mb-2" />
              <p className="fw-semibold mb-1 text-dark">No matching commands or services</p>
              <p className="small text-muted mb-3">Try searching "Plumber", "AC", "Wallet", "Electrician" or "Theme"</p>
              <button
                type="button"
                className="btn btn-sm btn-primary rounded-pill px-3"
                onClick={() => {
                  setIsCommandPaletteOpen(false);
                  navigate(`/customer/experts?q=${encodeURIComponent(query)}`);
                }}
              >
                Search all experts for "{query}" <ArrowRight size={14} className="ms-1" />
              </button>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => (
              <div
                key={cmd.id}
                className={`command-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="command-item-icon">{cmd.icon}</div>
                <div className="command-item-info">
                  <div className="command-item-title-row">
                    <span className="command-item-title">{cmd.title}</span>
                    <span className="command-item-category-badge">{cmd.badge || cmd.category}</span>
                  </div>
                  <span className="command-item-subtitle">{cmd.subtitle}</span>
                </div>
                {idx === selectedIndex && (
                  <CornerDownLeft size={14} className="command-item-enter-hint" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="command-palette-footer">
          <div className="command-footer-hints">
            <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
            <span><kbd>↵</kbd> to select</span>
            <span><kbd>ESC</kbd> to close</span>
          </div>
          <div className="command-footer-branding">
            Smart<strong>Fix</strong> Comfort Search
          </div>
        </div>
      </div>
    </div>
  );
}
