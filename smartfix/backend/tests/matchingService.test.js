const { rankWorkers } = require('../services/matchingService');

// Mock SystemConfig so DB calls do not run in tests
jest.mock('../models/SystemConfig', () => ({
  findOne: jest.fn().mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      value: {
        distanceWeight: 0.4,
        ratingWeight: 0.3,
        acceptanceRateWeight: 0.2,
        availabilityWeight: 0.1
      }
    })
  })
}));

describe('matchingService - rankWorkers', () => {
  const booking = {
    userLat: 9.8433,
    userLng: 78.4809,
    subServices: ['AC Installation']
  };

  test('filters out unapproved or offline workers', async () => {
    const workers = [
      { id: 'w1', availabilityStatus: 'Available', overallStatus: 'pending', lat: 9.8433, lng: 78.4809, subServices: ['AC Installation'] },
      { id: 'w2', availabilityStatus: 'Offline', overallStatus: 'approved', lat: 9.8433, lng: 78.4809, subServices: ['AC Installation'] },
      { id: 'w3', availabilityStatus: 'Available', overallStatus: 'approved', lat: 9.8433, lng: 78.4809, subServices: ['AC Installation'] }
    ];

    const result = await rankWorkers(workers, booking);
    expect(result.length).toBe(1);
    expect(result[0].workerId).toBe('w3');
  });

  test('filters out workers outside 5km radius', async () => {
    const workers = [
      { id: 'w1', availabilityStatus: 'Available', overallStatus: 'approved', lat: 9.8433, lng: 78.4809, subServices: ['AC Installation'] }, // 0 km
      { id: 'w2', availabilityStatus: 'Available', overallStatus: 'approved', lat: 10.8433, lng: 79.4809, subServices: ['AC Installation'] } // > 100 km
    ];

    const result = await rankWorkers(workers, booking);
    expect(result.length).toBe(1);
    expect(result[0].workerId).toBe('w1');
  });

  test('filters out workers without matching sub-service', async () => {
    const workers = [
      { id: 'w1', availabilityStatus: 'Available', overallStatus: 'approved', lat: 9.8433, lng: 78.4809, subServices: ['AC Repair'] },
      { id: 'w2', availabilityStatus: 'Available', overallStatus: 'approved', lat: 9.8433, lng: 78.4809, subServices: ['AC Installation'] }
    ];

    const result = await rankWorkers(workers, booking);
    expect(result.length).toBe(1);
    expect(result[0].workerId).toBe('w2');
  });

  test('prioritizes based on ratings, distance, and acceptance rate', async () => {
    // Both are at identical location (0 km).
    const workers = [
      { 
        id: 'w_no_rating', availabilityStatus: 'Available', overallStatus: 'approved', lat: 9.8433, lng: 78.4809, subServices: ['AC Installation'],
        rating: null, ratingCount: 0, jobsOffered: 10, jobsAccepted: 10 // score: 0.4(dist) + 0.3*0.6(rating) + 0.2*1.0(accept) + 0.1(avail) = 0.4 + 0.18 + 0.2 + 0.1 = 0.88
      },
      { 
        id: 'w_high_rating', availabilityStatus: 'Available', overallStatus: 'approved', lat: 9.8433, lng: 78.4809, subServices: ['AC Installation'],
        rating: 5, ratingCount: 100, jobsOffered: 10, jobsAccepted: 10 // score: 0.4(dist) + 0.3*1.0(rating) + 0.2*1.0(accept) + 0.1(avail) = 0.4 + 0.3 + 0.2 + 0.1 = 1.00
      },
      {
        id: 'w_low_accept', availabilityStatus: 'Available', overallStatus: 'approved', lat: 9.8433, lng: 78.4809, subServices: ['AC Installation'],
        rating: 5, ratingCount: 100, jobsOffered: 10, jobsAccepted: 0 // score: 0.4 + 0.3 + 0.0 + 0.1 = 0.8
      }
    ];

    const result = await rankWorkers(workers, booking);
    expect(result.length).toBe(3);
    
    // Sort descending
    expect(result[0].workerId).toBe('w_high_rating');
    expect(result[0].isTopMatch).toBe(true);

    expect(result[1].workerId).toBe('w_no_rating');
    expect(result[1].isTopMatch).toBe(false);

    expect(result[2].workerId).toBe('w_low_accept');
    expect(result[2].isTopMatch).toBe(false);

    // Ensure privacy: no name, phone, or direct rating fields
    expect(result[0].name).toBeUndefined();
    expect(result[0].phone).toBeUndefined();
    expect(result[0].rating).toBeUndefined();
  });
});
