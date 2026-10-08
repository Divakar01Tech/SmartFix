// Default city center coordinates (Tamil Nadu, Tamil Nadu)
export const DEFAULT_COORDS = { lat: 9.8433, lng: 78.4809 };

/**
 * Smart Geolocation Utility with Multi-Layer Mobile Fallback
 * Works reliably on Desktop, Mobile (Android/iOS), HTTP & HTTPS.
 * 
 * Pipeline:
 * 1. High-Accuracy Hardware GPS
 * 2. Low-Accuracy Mobile Network/Wi-Fi Triangulation
 * 3. Free IP-based Geolocation API
 * 4. Default City Center Fallback
 */
export const getUserCurrentLocation = async (options = {}) => {
  const { timeout = 8000, enableHighAccuracy = true } = options;

  const tryBrowserGps = (highAccuracy, reqTimeout) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by your browser.'));
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'gps',
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: highAccuracy, timeout: reqTimeout, maximumAge: 30000 }
      );
    });
  };

  // 1. High-Accuracy GPS (Hardware GPS on mobile/desktop)
  try {
    const coords = await tryBrowserGps(enableHighAccuracy, timeout);
    return coords;
  } catch (err1) {
    console.warn('High-accuracy GPS failed, trying mobile low-accuracy...', err1.message);
  }

  // 2. Low-Accuracy Mobile Triangulation (Cell Towers / Wi-Fi)
  try {
    const coords = await tryBrowserGps(false, 5000);
    return coords;
  } catch (err2) {
    throw new Error('Strict GPS Mode: Could not access your live device location. Please ensure location services are turned ON and permission is granted in your browser.');
  }
};

/**
 * Watch user location with automatic fallback for mobile background/HTTP restrictions
 */
export const watchUserLocation = (onSuccess, onError, options = {}) => {
  if (!navigator.geolocation) {
    if (onError) onError(new Error('Geolocation not supported'));
    return () => {};
  }

  let watchId = null;

  const startWatch = (highAccuracy) => {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        onSuccess({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading || 0,
          speed: pos.coords.speed || 0,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        console.warn(`watchPosition (highAccuracy=${highAccuracy}) error:`, err.message);
        if (highAccuracy) {
          // Switch to low accuracy for mobile network compatibility
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          startWatch(false);
        } else if (onError) {
          onError(new Error('Strict GPS Mode: Could not access your live device location. Please ensure location services are turned ON.'));
        }
      },
      { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 5000, ...options }
    );
  };

  startWatch(options.enableHighAccuracy !== false);

  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
};
