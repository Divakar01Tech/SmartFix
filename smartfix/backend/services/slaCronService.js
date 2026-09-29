const mongoose = require('mongoose');
const Booking = require('../models/Booking');

// Utility: Calculate Haversine distance in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in meters
}

const { callGeminiApi } = require('./geminiService');

const gmapsCache = new Map();

async function getTravelTimeFromGoogle(originLat, originLng, destLat, destLng) {
  const cacheKey = `${originLat},${originLng}|${destLat},${destLng}`;
  if (gmapsCache.has(cacheKey)) {
    const cached = gmapsCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 120000) return cached.durationSeconds;
  }
  
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GMAPS_API_KEY;
  if (!apiKey) return null;
  
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const durationSeconds = data.rows[0].elements[0].duration.value;
      gmapsCache.set(cacheKey, { durationSeconds, timestamp: Date.now() });
      return durationSeconds;
    }
  } catch(e) {
    console.error('GMaps API error:', e.message);
  }
  return null;
}

/**
 * Sweeper function running every 1 minute to detect SLA breaches and warnings
 */
async function runSlaBreachSweep(io) {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const now = new Date();
    
    // Find active jobs not yet Arrived/Completed
    const activeBookings = await Booking.find({
      status: { $in: ['Confirmed', 'Accepted', 'EnRoute'] },
      slaBreached: { $ne: true },
      slaDeadline: { $exists: true }
    }).populate('customer', 'lat lng locationPoint name phone').populate('worker', 'name phone trade punctualityRate');

    if (!activeBookings || activeBookings.length === 0) return;

    for (const booking of activeBookings) {
      const msRemaining = booking.slaDeadline.getTime() - now.getTime();
      const minutesRemaining = Math.floor(msRemaining / 60000);

      // 0. Proactive SLA-breach prediction
      if (!booking.slaRiskNotified) {
        const custLng = booking.customer?.locationPoint?.coordinates?.[0];
        const custLat = booking.customer?.locationPoint?.coordinates?.[1];
        const workerLng = booking.tracking?.lastLng || booking.worker?.locationPoint?.coordinates?.[0];
        const workerLat = booking.tracking?.lastLat || booking.worker?.locationPoint?.coordinates?.[1];
        
        if (custLat && custLng && workerLat && workerLng) {
          const distMeters = getDistanceFromLatLonInMeters(workerLat, workerLng, custLat, custLng);
          // Cheap first pass: avg speed 30 km/h (8.33 m/s)
          let travelTimeMins = (distMeters / 8.33) / 60;
          let predictedArrival = new Date(now.getTime() + travelTimeMins * 60000);
          
          const deadlineBuffer = new Date(booking.slaDeadline.getTime() - 5 * 60000);
          
          let lastLocTime = booking.tracking?.lastUpdate || new Date();
          let locationStale = (now.getTime() - lastLocTime.getTime()) > 120000;
          let deadlineClose = (booking.slaDeadline.getTime() - now.getTime()) < 20 * 60000;
          
          if (predictedArrival > deadlineBuffer || (locationStale && deadlineClose)) {
            // Might be late. Check real ETA via Google
            const realTravelTimeSec = await getTravelTimeFromGoogle(workerLat, workerLng, custLat, custLng);
            
            if (realTravelTimeSec !== null) {
              travelTimeMins = realTravelTimeSec / 60;
              predictedArrival = new Date(now.getTime() + realTravelTimeSec * 1000);
            }
            
            if (predictedArrival > deadlineBuffer) {
              const minutesLate = Math.ceil((predictedArrival.getTime() - booking.slaDeadline.getTime()) / 60000);
              
              booking.slaRisk = {
                level: 'high',
                predictedArrival,
                minutesLate: minutesLate > 0 ? minutesLate : 0,
                computedAt: now
              };
              booking.slaRiskNotified = true;
              await booking.save();
              
              // Alerts
              if (io) {
                // Worker alert
                io.to(`user-${booking.worker._id}`).emit('sla-risk-alert', {
                  bookingId: booking._id,
                  message: "You may miss the arrival window"
                });
                // Customer alert
                io.to(`user-${booking.customer._id}`).emit('sla-risk-alert', {
                  bookingId: booking._id,
                  message: `Your professional is on the way. Updated ETA is ${predictedArrival.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`
                });
                
                // AI Explanation for Admin
                let explanation = null;
                try {
                  const prompt = `Worker is ${Math.round(distMeters)}m away. ETA: ${travelTimeMins.toFixed(1)} mins. Deadline: ${Math.round(msRemaining/60000)} mins from now. Punctuality rate: ${booking.worker.punctualityRate || 'unknown'}. Write a 1-sentence assessment using only these numbers, no PII.`;
                  const aiResult = await callGeminiApi([{ role: 'user', content: prompt }], 0.4, 100);
                  if (aiResult && aiResult.text) {
                     explanation = aiResult.text;
                  }
                } catch(e) {}

                const adminPayload = {
                  bookingId: booking._id,
                  distanceMeters: Math.round(distMeters),
                  predictedArrival,
                  minutesLate: booking.slaRisk.minutesLate,
                  workerName: booking.worker.name,
                  customerName: booking.customer.name,
                  explanation
                };
                io.to('admin-room').emit('admin-sla-risk', adminPayload);
              }
            }
          }
        }
      }

      // 1. Check for SLA Warning (<= 15 mins remaining, so past 45 min mark)
      if (minutesRemaining <= 15 && minutesRemaining > 0 && !booking.slaWarningSent) {
        booking.slaWarningSent = true;
        await booking.save();
        
        if (io) {
          const warningPayload = {
            bookingId: booking._id,
            message: `SLA Warning: Only ${minutesRemaining} minutes left until SLA breach.`,
            minutesRemaining
          };
          io.to(`booking:${booking._id}`).emit('sla-warning', warningPayload);
          io.to(`user-${booking.worker?._id}`).emit('sla-warning', warningPayload);
          io.to(`user-${booking.customer?._id}`).emit('sla-warning', warningPayload);
        }
      }

      // 2. Check for SLA Breach (< 0 mins remaining)
      if (minutesRemaining < 0) {
        booking.slaBreached = true;
        booking.status = 'SLABreached';

        // Compute breach distance if we have location data
        if (booking.tracking?.lastLat && booking.tracking?.lastLng && booking.customer?.locationPoint?.coordinates) {
          const custLng = booking.customer.locationPoint.coordinates[0];
          const custLat = booking.customer.locationPoint.coordinates[1];
          booking.breachDistanceMeters = getDistanceFromLatLonInMeters(
            booking.tracking.lastLat,
            booking.tracking.lastLng,
            custLat,
            custLng
          );
        }

        await booking.save();

        console.warn(`⏰ [SLA_BREACH] Booking #${booking._id.toString().slice(-6)} flagged as SLA Breached. Distance: ${booking.breachDistanceMeters}m`);

        if (io) {
          const breachPayload = {
            bookingId: booking._id,
            trade: booking.trade,
            workerName: booking.worker?.name || 'Assigned Worker',
            customerName: booking.customer?.name || 'Customer',
            breachDistanceMeters: booking.breachDistanceMeters,
            breachedAt: new Date().toISOString(),
            message: `⚠️ SLA Breach Alert: Job #${booking._id.toString().slice(-6)} exceeded SLA limit!`,
          };

          io.to(`booking:${booking._id}`).emit('sla-breached', breachPayload);
          io.to(`user-${booking.customer?._id || booking.customer}`).emit('sla-alert', breachPayload);
          io.to('admin-room').emit('sla-breach-alert', breachPayload);
          io.emit('sla-breach-alert', breachPayload); // global fallback
          io.to(`booking:${booking._id}`).emit('tracking-ended', { bookingId: booking._id, status: 'SLABreached' });
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ SLA Breach sweep notice:', err.message);
  }
}

function initSlaBreachCron(io) {
  setTimeout(() => runSlaBreachSweep(io), 10000);
  setInterval(() => runSlaBreachSweep(io), 60000);
  console.log('⏰ SLA Breach & Warning sweep initialized.');
}

module.exports = { initSlaBreachCron, runSlaBreachSweep };
