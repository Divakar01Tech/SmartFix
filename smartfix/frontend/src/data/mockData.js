import { HOME_SERVICES } from './servicesData';

export const categories = HOME_SERVICES.map((s) => ({
  id: s.id,
  name: s.name,
  icon: s.icon,
  subServices: s.subServices,
}));

export const getStoredWorkers = () => {
  try {
    const saved = localStorage.getItem('smartfix_manual_workers');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading workers from localStorage:', e);
  }
  return [];
};

export const saveWorkerToStorage = (workerData) => {
  try {
    const current = getStoredWorkers();
    const newWorker = {
      id: workerData.id || workerData._id || `w_${Date.now()}`,
      _id: workerData._id || workerData.id || `w_${Date.now()}`,
      name: workerData.name,
      trade: workerData.trade || 'Plumbing',
      subServices: workerData.subServices || [],
      location: workerData.location || 'Tamil Nadu',
      ratePerHour: Number(workerData.ratePerHour) || 350,
      rating: workerData.rating || 5.0,
      ratingCount: workerData.ratingCount || 1,
      experience: workerData.experience || '3 years',
      phone: workerData.phone || '+91 98765 43210',
      avatar: workerData.avatar || '👨‍🔧',
      lat: Number(workerData.lat) || 9.8433,
      lng: Number(workerData.lng) || 78.4809,
    };
    const updated = [newWorker, ...current.filter((w) => (w.id || w._id) !== (newWorker.id || newWorker._id))];
    localStorage.setItem('smartfix_manual_workers', JSON.stringify(updated));
    return newWorker;
  } catch (e) {
    console.warn('Error saving worker to localStorage:', e);
    return workerData;
  }
};

export const deleteWorkerFromStorage = (workerId) => {
  try {
    const current = getStoredWorkers();
    const updated = current.filter((w) => (w.id || w._id) !== workerId);
    localStorage.setItem('smartfix_manual_workers', JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Error deleting worker from localStorage:', e);
    return [];
  }
};

// Default empty mock workers list — user adds workers manually!
export const mockWorkers = getStoredWorkers();

export const mockBookings = [];
