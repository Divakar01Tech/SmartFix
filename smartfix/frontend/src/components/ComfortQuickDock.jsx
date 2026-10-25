import React, { useState, useEffect } from 'react';
import {
  Search, Sliders, Heart, ArrowUp, Zap
} from 'lucide-react';
import { useComfort } from '../context/ComfortContext';
import './ComfortQuickDock.css';

export default function ComfortQuickDock() {
  const {
    setIsCommandPaletteOpen,
    setIsComfortModalOpen,
    setIsSavedModalOpen,
    favoriteWorkers,
  } = useComfort();

  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const currentProgress = (window.scrollY / totalScroll) * 100;
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)));
      }
      setShowScrollTop(window.scrollY > 320);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="comfort-quick-dock" aria-label="Quick comfort tools">
      {/* 1. Quick Search Trigger */}
      <button
        type="button"
        className="comfort-dock-btn"
        onClick={() => setIsCommandPaletteOpen(true)}
        title="Quick Search (Ctrl + K)"
        aria-label="Open Quick Search"
      >
        <Search size={16} />
        <span className="comfort-dock-kbd d-none d-md-inline">⌘K</span>
      </button>

      {/* 2. Accessibility & Comfort Settings */}
      <button
        type="button"
        className="comfort-dock-btn"
        onClick={() => setIsComfortModalOpen(true)}
        title="Comfort & Text Size Settings (Alt + A)"
        aria-label="Open Comfort Settings"
      >
        <span className="comfort-dock-text-icon">Aa</span>
      </button>

      {/* 3. Saved Specialists */}
      <button
        type="button"
        className="comfort-dock-btn position-relative"
        onClick={() => setIsSavedModalOpen(true)}
        title={`Saved Specialists (${favoriteWorkers.length}) (Alt + S)`}
        aria-label="Open Saved Specialists"
      >
        <Heart
          size={16}
          className={favoriteWorkers.length > 0 ? 'text-danger' : ''}
          style={favoriteWorkers.length > 0 ? { fill: '#ef4444' } : {}}
        />
        {favoriteWorkers.length > 0 && (
          <span className="comfort-dock-badge">
            {favoriteWorkers.length}
          </span>
        )}
      </button>

      {/* 4. Smooth Back To Top with Progress Ring */}
      {showScrollTop && (
        <button
          type="button"
          className="comfort-dock-btn comfort-scroll-top-btn animate-fade-in"
          onClick={scrollToTop}
          title={`Scroll to top (${Math.round(scrollProgress)}%)`}
          aria-label="Scroll to top"
        >
          <svg className="comfort-progress-ring" width="34" height="34">
            <circle
              className="comfort-progress-ring-bg"
              cx="17"
              cy="17"
              r="14"
            />
            <circle
              className="comfort-progress-ring-fill"
              cx="17"
              cy="17"
              r="14"
              style={{
                strokeDasharray: 88,
                strokeDashoffset: 88 - (88 * scrollProgress) / 100,
              }}
            />
          </svg>
          <ArrowUp size={14} className="comfort-scroll-arrow" />
        </button>
      )}
    </div>
  );
}
