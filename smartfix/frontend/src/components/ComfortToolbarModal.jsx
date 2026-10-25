import React from 'react';
import {
  X, Type, Eye, ZapOff, Sun, Moon, Globe,
  RotateCcw, Check, Sparkles, Sliders, ShieldCheck
} from 'lucide-react';
import { useComfort } from '../context/ComfortContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import './ComfortToolbarModal.css';

export default function ComfortToolbarModal() {
  const {
    isComfortModalOpen,
    setIsComfortModalOpen,
    fontSize,
    setFontSize,
    highContrast,
    toggleHighContrast,
    reducedMotion,
    toggleReducedMotion,
    resetComfortSettings,
  } = useComfort();

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  if (!isComfortModalOpen) return null;

  return (
    <div
      className="comfort-modal-backdrop animate-fade-in"
      onClick={() => setIsComfortModalOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="comfort-modal-container animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="comfort-modal-header">
          <div className="d-flex align-items-center gap-2">
            <div className="comfort-icon-box">
              <Sliders size={20} color="#2563eb" />
            </div>
            <div>
              <h5 className="comfort-title mb-0">Comfort & Accessibility</h5>
              <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                Personalize your reading comfort, contrast & motion
              </small>
            </div>
          </div>
          <button
            type="button"
            className="comfort-close-btn"
            onClick={() => setIsComfortModalOpen(false)}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="comfort-modal-body">
          {/* Section 1: Font Size Scaling */}
          <div className="comfort-section">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="comfort-section-label">
                <Type size={16} className="text-primary me-1" />
                Text Size (Reading Scale)
              </label>
              <span className="badge bg-primary-subtle text-primary fw-bold" style={{ fontSize: '0.72rem' }}>
                {fontSize === 'normal' ? 'Standard 100%' : fontSize === 'large' ? 'Large 112%' : 'Extra Large 125%'}
              </span>
            </div>

            <div className="comfort-btn-group">
              <button
                type="button"
                className={`comfort-option-btn ${fontSize === 'normal' ? 'active' : ''}`}
                onClick={() => setFontSize('normal')}
              >
                <span style={{ fontSize: '0.9rem' }}>A</span>
                <span className="comfort-btn-sub">Normal</span>
              </button>
              <button
                type="button"
                className={`comfort-option-btn ${fontSize === 'large' ? 'active' : ''}`}
                onClick={() => setFontSize('large')}
              >
                <span style={{ fontSize: '1.15rem' }}>A+</span>
                <span className="comfort-btn-sub">Large</span>
              </button>
              <button
                type="button"
                className={`comfort-option-btn ${fontSize === 'xlarge' ? 'active' : ''}`}
                onClick={() => setFontSize('xlarge')}
              >
                <span style={{ fontSize: '1.35rem' }}>A++</span>
                <span className="comfort-btn-sub">Extra Large</span>
              </button>
            </div>

            {/* Live Sample Sentence */}
            <div className="comfort-preview-box mt-2">
              <span className="comfort-preview-text">
                {language === 'ta'
                  ? 'சிவகங்கை மாவட்ட நம்பகமான பழுதுநீக்க சேவை & தொழில்நுட்ப வல்லுநர்கள்'
                  : 'Sivagangai District Home Services & Verified Specialist Network'}
              </span>
            </div>
          </div>

          {/* Section 2: High Contrast Mode */}
          <div className="comfort-section">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <label className="comfort-section-label mb-0">
                  <Eye size={16} className="text-warning me-1" />
                  High Contrast Mode
                </label>
                <p className="comfort-section-desc mb-0">
                  Sharp borders & ultra-high contrast for outdoor sunlight readability
                </p>
              </div>
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input comfort-switch"
                  type="checkbox"
                  role="switch"
                  id="highContrastSwitch"
                  checked={highContrast}
                  onChange={toggleHighContrast}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Reduced Motion */}
          <div className="comfort-section">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <label className="comfort-section-label mb-0">
                  <ZapOff size={16} className="text-info me-1" />
                  Reduced Motion
                </label>
                <p className="comfort-section-desc mb-0">
                  Disables background floating & bouncy animations for a calm visual experience
                </p>
              </div>
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input comfort-switch"
                  type="checkbox"
                  role="switch"
                  id="reducedMotionSwitch"
                  checked={reducedMotion}
                  onChange={toggleReducedMotion}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Theme Mode */}
          <div className="comfort-section">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <label className="comfort-section-label mb-0">
                  {theme === 'dark' ? <Moon size={16} className="text-warning me-1" /> : <Sun size={16} className="text-warning me-1" />}
                  Theme Mode
                </label>
                <p className="comfort-section-desc mb-0">
                  {theme === 'dark' ? 'Dark theme is active (easier on eyes at night)' : 'Light theme is active (clean daylight look)'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-bold d-flex align-items-center gap-1"
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} />}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
          </div>

          {/* Section 5: Language Selection */}
          <div className="comfort-section">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <label className="comfort-section-label mb-0">
                  <Globe size={16} className="text-primary me-1" />
                  Display Language
                </label>
                <p className="comfort-section-desc mb-0">
                  Switch between English and தமிழ் (Tamil)
                </p>
              </div>
              <div className="btn-group p-1 bg-light rounded-pill border" role="group">
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill fw-bold px-2 py-1 ${language === 'en' ? 'btn-primary text-white' : 'btn-light text-secondary'}`}
                  onClick={() => setLanguage('en')}
                  style={{ fontSize: '0.75rem' }}
                >
                  English
                </button>
                <button
                  type="button"
                  className={`btn btn-sm rounded-pill fw-bold px-2 py-1 ${language === 'ta' ? 'btn-primary text-white' : 'btn-light text-secondary'}`}
                  onClick={() => setLanguage('ta')}
                  style={{ fontSize: '0.75rem' }}
                >
                  தமிழ்
                </button>
              </div>
            </div>
          </div>

          {/* Section 6: Shortcuts Cheat Sheet */}
          <div className="comfort-shortcuts-card p-3 rounded-3 mt-3">
            <div className="d-flex align-items-center gap-1 fw-bold text-dark mb-2" style={{ fontSize: '0.82rem' }}>
              <Sparkles size={14} className="text-warning" />
              Keyboard Shortcuts
            </div>
            <div className="row g-2" style={{ fontSize: '0.76rem' }}>
              <div className="col-6 d-flex align-items-center justify-content-between pe-2">
                <span className="text-muted">Quick Search:</span>
                <kbd>Ctrl + K</kbd>
              </div>
              <div className="col-6 d-flex align-items-center justify-content-between ps-2">
                <span className="text-muted">Comfort Settings:</span>
                <kbd>Alt + A</kbd>
              </div>
              <div className="col-6 d-flex align-items-center justify-content-between pe-2">
                <span className="text-muted">Saved Specialists:</span>
                <kbd>Alt + S</kbd>
              </div>
              <div className="col-6 d-flex align-items-center justify-content-between ps-2">
                <span className="text-muted">Close Popups:</span>
                <kbd>ESC</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="comfort-modal-footer">
          <button
            type="button"
            className="btn btn-sm btn-link text-secondary text-decoration-none d-flex align-items-center gap-1"
            onClick={resetComfortSettings}
          >
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary rounded-pill px-4 fw-bold"
            onClick={() => setIsComfortModalOpen(false)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
