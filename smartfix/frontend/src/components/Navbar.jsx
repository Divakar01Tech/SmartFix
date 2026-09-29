import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Search, Wrench, User, LogOut, LayoutDashboard, ShieldCheck, ChevronDown, Sun, Moon, Bell } from 'lucide-react';
import { getApiBase } from '../services/api';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/browse?q=${encodeURIComponent(search)}`);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      const apiBase = getApiBase();
      const token = localStorage.getItem('smartfix_token');
      fetch(`${apiBase}/auth/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotifications(data.notifications);
        }
      }).catch(err => console.error(err));
    }
  }, [isAuthenticated]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotifClick = () => {
    setNotifOpen(!notifOpen);
    if (!notifOpen && unreadCount > 0) {
      const apiBase = getApiBase();
      const token = localStorage.getItem('smartfix_token');
      fetch(`${apiBase}/auth/notifications/read`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(() => {
        setNotifications(prev => prev.map(n => ({...n, isRead: true})));
      }).catch(err => console.error(err));
    }
  };

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    navigate('/');
  };

  const dashboardPath =
    user?.role === 'admin'
      ? '/admin'
      : user?.role === 'handyman'
      ? '/handyman-dashboard'
      : '/customer-dashboard';

  return (
    <header className="navbar">
      <div className="navbar-top container">
        <Link to="/" className="navbar-logo">
          <div className="logo-icon-box"><Wrench size={20} color="#ffffff" /></div>
          <span>Smart<strong>Fix</strong></span>
        </Link>

        <form className="navbar-search" onSubmit={handleSearch}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t('search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="search-btn">{t('search_btn')}</button>
        </form>

        <div className="navbar-right">
          {/* Pill-Style Language Toggle (EN | தமிழ்) */}
          <div className="btn-group p-1 bg-light rounded-pill border shadow-xs" role="group" aria-label="Language Toggle" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button
              type="button"
              className={`btn btn-sm rounded-pill fw-extrabold px-3 py-1 ${language === 'en' ? 'btn-primary text-white shadow-xs' : 'btn-light text-secondary'}`}
              onClick={() => setLanguage('en')}
              style={{ fontSize: '0.78rem', transition: 'all 0.2s' }}
            >
              EN
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-pill fw-extrabold px-3 py-1 ${language === 'ta' ? 'btn-primary text-white shadow-xs' : 'btn-light text-secondary'}`}
              onClick={() => setLanguage('ta')}
              style={{ fontSize: '0.78rem', transition: 'all 0.2s' }}
            >
              தமிழ்
            </button>
          </div>

          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? t('dark_mode') : t('light_mode')}
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} color="#475569" /> : <Sun size={18} color="#f59e0b" />}
          </button>

          <Link to="/browse" className={`nav-link ${location.pathname === '/browse' ? 'active' : ''}`}>
            {t('browse_experts')}
          </Link>

          {isAuthenticated && (
            <div className="account-dropdown" ref={notifRef}>
              <button type="button" className="account-trigger" style={{ position: 'relative' }} onClick={handleNotifClick}>
                <Bell size={20} className="text-secondary" />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: 'red', color: 'white', borderRadius: '50%', fontSize: '0.65rem', padding: '2px 5px' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="dropdown-menu show custom-dropdown-menu" style={{ width: '300px', right: 0, left: 'auto', padding: '10px' }}>
                  <h6 className="dropdown-header border-bottom pb-2 mb-2">Notifications</h6>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div className="text-muted small text-center py-3">No new notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div key={n._id} className="dropdown-item py-2 px-3 border-bottom" style={{ whiteSpace: 'normal', cursor: n.actionData?.link ? 'pointer' : 'default' }} onClick={() => {
                          if (n.actionData?.link) {
                            navigate(n.actionData.link);
                            setNotifOpen(false);
                          }
                        }}>
                          <strong className="d-block text-dark" style={{ fontSize: '0.85rem' }}>{n.title}</strong>
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>{n.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {isAuthenticated ? (
            <div
              className="account-dropdown"
              ref={dropdownRef}
            >
              <button
                type="button"
                className="account-trigger"
                onClick={() => setDropdownOpen((prev) => !prev)}
              >
                {user?.role === 'handyman' ? (
                  <Wrench size={16} className="text-success" />
                ) : user?.role === 'admin' ? (
                  <ShieldCheck size={16} className="text-primary" />
                ) : (
                  <User size={16} className="text-primary" />
                )}
                <span>Hi, {user?.name?.split(' ')[0] || 'User'}</span>
                <ChevronDown size={14} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
              </button>

              {dropdownOpen && (
                <div className="dropdown-menu show custom-dropdown-menu">
                  <div className="dropdown-user-info">
                    <strong>{user?.name}</strong>
                    <small className="d-flex align-items-center gap-1 mt-1">
                      {user?.role === 'handyman' ? (
                        <span className="badge bg-success-subtle text-success border d-flex align-items-center gap-1 px-2 py-1 rounded-pill">
                          <Wrench size={12} /> {user?.trade || 'Handyman Service'}
                        </span>
                      ) : user?.role === 'admin' ? (
                        <span className="badge bg-primary-subtle text-primary border d-flex align-items-center gap-1 px-2 py-1 rounded-pill">
                          <ShieldCheck size={12} /> System Admin
                        </span>
                      ) : (
                        <span className="badge bg-info-subtle text-info-emphasis border d-flex align-items-center gap-1 px-2 py-1 rounded-pill">
                          <User size={12} /> Customer
                        </span>
                      )}
                    </small>
                  </div>
                  <hr />
                  <Link
                    to={dashboardPath}
                    className="dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <LayoutDashboard size={16} /> {t('my_dashboard')}
                  </Link>

                  {user?.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <ShieldCheck size={16} /> {t('admin_console')}
                    </Link>
                  )}

                  <Link
                    to="/profile"
                    className="dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User size={16} /> {t('profile_settings')}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="dropdown-item logout-item"
                  >
                    <LogOut size={16} /> {t('logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="login-btn">
              {t('login_register')}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
