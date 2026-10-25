import React from 'react';
import { WifiOff, Wifi, X } from 'lucide-react';
import { useComfort } from '../context/ComfortContext';
import './OfflineAlert.css';

export default function OfflineAlert() {
  const { isOnline, offlineToastVisible, setOfflineToastVisible, connectionMessage } = useComfort();

  if (!offlineToastVisible && isOnline) return null;

  return (
    <div
      className={`offline-alert-container ${isOnline ? 'online-restored' : 'offline-active'} animate-slide-up`}
      role="status"
      aria-live="polite"
    >
      <div className="offline-alert-content">
        <div className="offline-icon-box">
          {isOnline ? (
            <Wifi size={18} className="text-success" />
          ) : (
            <WifiOff size={18} className="text-warning" />
          )}
        </div>
        <div className="offline-text-content">
          <p className="offline-title mb-0">
            {isOnline ? 'Connection Restored' : 'You are currently offline'}
          </p>
          <p className="offline-desc mb-0">
            {connectionMessage || (isOnline
              ? 'Your internet connection is back. Syncing latest data.'
              : 'Cached pages remain accessible. Bookings will sync once restored.')}
          </p>
        </div>
        <button
          type="button"
          className="offline-dismiss-btn"
          onClick={() => setOfflineToastVisible(false)}
          aria-label="Dismiss alert"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
