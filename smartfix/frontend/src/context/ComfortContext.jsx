import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ComfortContext = createContext();

export const ComfortProvider = ({ children }) => {
  // 1. Font Size: 'normal' | 'large' | 'xlarge'
  const [fontSize, setFontSizeState] = useState(() => {
    try {
      return localStorage.getItem('smartfix_font_size') || 'normal';
    } catch {
      return 'normal';
    }
  });

  // 2. High Contrast: boolean
  const [highContrast, setHighContrastState] = useState(() => {
    try {
      return localStorage.getItem('smartfix_high_contrast') === 'true';
    } catch {
      return false;
    }
  });

  // 3. Reduced Motion: boolean
  const [reducedMotion, setReducedMotionState] = useState(() => {
    try {
      return localStorage.getItem('smartfix_reduced_motion') === 'true';
    } catch {
      return false;
    }
  });

  // 4. Saved / Favorite Workers
  const [favoriteWorkers, setFavoriteWorkers] = useState(() => {
    try {
      const saved = localStorage.getItem('smartfix_favorite_workers');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Error loading favorite workers:', e);
    }
    return [];
  });

  // 5. Online Status
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineToastVisible, setOfflineToastVisible] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');

  // 6. Modals & Command Palette States
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isComfortModalOpen, setIsComfortModalOpen] = useState(false);
  const [isSavedModalOpen, setIsSavedModalOpen] = useState(false);

  // Sync font size to documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    try {
      localStorage.setItem('smartfix_font_size', fontSize);
    } catch {}
  }, [fontSize]);

  // Sync high contrast to documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', highContrast ? 'high' : 'normal');
    try {
      localStorage.setItem('smartfix_high_contrast', String(highContrast));
    } catch {}
  }, [highContrast]);

  // Sync reduced motion to documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');
    try {
      localStorage.setItem('smartfix_reduced_motion', String(reducedMotion));
    } catch {}
  }, [reducedMotion]);

  // Sync favorite workers to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('smartfix_favorite_workers', JSON.stringify(favoriteWorkers));
    } catch (e) {
      console.warn('Error saving favorite workers:', e);
    }
  }, [favoriteWorkers]);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionMessage('🟢 Back online! Connection restored.');
      setOfflineToastVisible(true);
      setTimeout(() => {
        setOfflineToastVisible(false);
      }, 5000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionMessage("⚠️ You're currently offline. Cached services remain available. Any bookings will sync once restored.");
      setOfflineToastVisible(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is in an input or textarea, UNLESS pressing Ctrl+K or Escape
      const tag = e.target.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

      // 1. Ctrl + K or Cmd + K -> Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // 2. Alt + A -> Comfort & Accessibility Settings Modal
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setIsComfortModalOpen((prev) => !prev);
        return;
      }

      // 3. Alt + S -> Saved Workers Modal
      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSavedModalOpen((prev) => !prev);
        return;
      }

      // 4. Escape -> Close any open modals
      if (e.key === 'Escape') {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        if (isComfortModalOpen) setIsComfortModalOpen(false);
        if (isSavedModalOpen) setIsSavedModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, isComfortModalOpen, isSavedModalOpen]);

  // Helper actions
  const setFontSize = useCallback((size) => {
    if (['normal', 'large', 'xlarge'].includes(size)) {
      setFontSizeState(size);
    }
  }, []);

  const toggleHighContrast = useCallback(() => {
    setHighContrastState((prev) => !prev);
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setReducedMotionState((prev) => !prev);
  }, []);

  const resetComfortSettings = useCallback(() => {
    setFontSizeState('normal');
    setHighContrastState(false);
    setReducedMotionState(false);
  }, []);

  // Check if a worker is in favorites
  const isFavorite = useCallback(
    (workerId) => {
      if (!workerId) return false;
      const cleanId = String(workerId);
      return favoriteWorkers.some((w) => String(w._id || w.id) === cleanId);
    },
    [favoriteWorkers]
  );

  // Toggle favorite worker
  const toggleFavorite = useCallback((worker) => {
    if (!worker) return;
    const workerId = String(worker._id || worker.id);
    setFavoriteWorkers((prev) => {
      const exists = prev.some((w) => String(w._id || w.id) === workerId);
      if (exists) {
        return prev.filter((w) => String(w._id || w.id) !== workerId);
      } else {
        const minimalWorker = {
          _id: workerId,
          id: workerId,
          name: worker.name || 'Specialist',
          trade: worker.trade || 'Handyman',
          subServices: worker.subServices || [],
          location: worker.location || 'Sivagangai District',
          ratePerHour: worker.ratePerHour || 350,
          rating: worker.rating || 5.0,
          ratingCount: worker.ratingCount || 1,
          avatar: worker.avatar || '👨‍🔧',
          experience: worker.experience || '3+ years exp',
          isOnline: worker.isOnline !== false,
          phone: worker.phone || '',
          savedAt: new Date().toISOString(),
        };
        return [minimalWorker, ...prev];
      }
    });
  }, []);

  const removeFavorite = useCallback((workerId) => {
    const cleanId = String(workerId);
    setFavoriteWorkers((prev) => prev.filter((w) => String(w._id || w.id) !== cleanId));
  }, []);

  return (
    <ComfortContext.Provider
      value={{
        fontSize,
        setFontSize,
        highContrast,
        setHighContrast: setHighContrastState,
        toggleHighContrast,
        reducedMotion,
        setReducedMotion: setReducedMotionState,
        toggleReducedMotion,
        resetComfortSettings,

        favoriteWorkers,
        isFavorite,
        toggleFavorite,
        removeFavorite,

        isOnline,
        offlineToastVisible,
        setOfflineToastVisible,
        connectionMessage,

        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isComfortModalOpen,
        setIsComfortModalOpen,
        isSavedModalOpen,
        setIsSavedModalOpen,
      }}
    >
      {children}
    </ComfortContext.Provider>
  );
};

export const useComfort = () => {
  const context = useContext(ComfortContext);
  if (!context) {
    throw new Error('useComfort must be used within a ComfortProvider');
  }
  return context;
};

export default ComfortContext;
