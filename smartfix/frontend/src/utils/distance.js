// Haversine formula to calculate great-circle distance between two points in km
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 2.5;

  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

// Base coordinates for Sivagangai District towns & major Tamil Nadu cities
export const CITY_COORDINATES = {
  'Sivagangai Town': [9.8433, 78.4809],
  'Sivagangai, Tamil Nadu': [9.8433, 78.4809],
  'Sivagangai': [9.8433, 78.4809],
  'Karaikudi': [9.8965, 78.7844],
  'Karaikudi, Sivagangai': [9.8965, 78.7844],
  'Devakottai': [9.9482, 78.8247],
  'Manamadurai': [9.6953, 78.4831],
  'Kalayarkoil': [9.8517, 78.6432],
  'Tiruppattur': [10.1147, 78.6186],
  'Singampunari': [10.1983, 78.4419],
  'Ilayangudi': [9.6333, 78.6333],
  'Thirupuvanam': [9.8700, 78.2700],
  'Kanadukathan': [9.9555, 78.7833],
  'Madurai, Tamil Nadu': [9.9252, 78.1198],
  'Madurai': [9.9252, 78.1198],
  'Trichy, Tamil Nadu': [10.7905, 78.7047],
  'Chennai, Tamil Nadu': [13.0827, 80.2707],
  'Coimbatore, Tamil Nadu': [11.0168, 76.9558],
};

export function getCityBase(location) {
  if (!location) return CITY_COORDINATES['Sivagangai Town'];
  if (CITY_COORDINATES[location]) return CITY_COORDINATES[location];
  
  const locLower = location.toLowerCase();
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (locLower.includes(key.toLowerCase()) || key.toLowerCase().includes(locLower)) {
      return coords;
    }
  }
  return CITY_COORDINATES['Sivagangai Town'];
}

// Returns deterministic lat/lng coordinates for a worker based on ID/index within 0.5km - 4km of city center
export function getWorkerCoordinates(worker, index = 0) {
  if (worker.lat && worker.lng) {
    return [worker.lat, worker.lng];
  }

  const base = getCityBase(worker.location);
  
  // Use deterministic offset based on index / name hash
  const idx = typeof index === 'number' ? index : (worker.name ? worker.name.length : 1);
  const latOffset = ((idx % 3) - 1) * 0.012 + (((idx * 7) % 5) - 2) * 0.003;
  const lngOffset = ((Math.floor(idx / 3) % 3) - 1) * 0.015 + (((idx * 3) % 4) - 1.5) * 0.003;

  return [base[0] + latOffset, base[1] + lngOffset];
}

// Calculate distance of worker from reference center (defaults to Sivagangai Town center)
export function getWorkerDistance(worker, userLat = 9.8433, userLng = 78.4809, index = 0) {
  const [wLat, wLng] = getWorkerCoordinates(worker, index);
  return calculateDistance(userLat, userLng, wLat, wLng);
}

