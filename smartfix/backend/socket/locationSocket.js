const Booking = require('../models/Booking');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

function initLocationSocket(io) {
  // 1. & 2. Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { userId: decoded.id, role: decoded.role };
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  // Memory map to throttle location updates per booking (Requirement 4)
  const locationThrottler = new Map();

  io.on('connection', (socket) => {
    console.log(`⚡ Authenticated Socket connected: ${socket.id} (User: ${socket.user.userId})`);

    // Join user-specific room
    socket.on('join-user', () => {
      const room = `user-${socket.user.userId}`;
      socket.join(room);
    });

    // Join admin room
    socket.on('join-admin-room', () => {
      if (socket.user.role === 'Admin') {
        socket.join('admin-room');
      }
    });

    // 3. Room-per-booking architecture with strict access control
    socket.on('join-booking-room', async ({ bookingId }) => {
      if (!bookingId) return;

      try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
          socket.emit('error', 'Booking not found');
          return;
        }

        // Verify userId matches customer or worker for this booking
        const isCustomer = booking.customer.toString() === socket.user.userId;
        const isWorker = booking.worker && booking.worker.toString() === socket.user.userId;

        if (!isCustomer && !isWorker) {
          socket.emit('error', 'Access denied to this booking room');
          return;
        }

        // Verify status is Accepted, Confirmed, En Route, or Arrived
        const allowedStatuses = ['Accepted', 'Confirmed', 'EnRoute', 'Arrived'];
        if (!allowedStatuses.includes(booking.status)) {
          socket.emit('error', 'Tracking not allowed for this booking status');
          return;
        }

        const room = `booking:${bookingId}`;
        socket.join(room);
        console.log(`📌 User ${socket.user.userId} joined room ${room}`);
        
        // Disconnect/Reconnect handling: Send last known location immediately
        if (booking.tracking?.lastLat && booking.tracking?.lastLng) {
          socket.emit('worker-location', {
            latitude: booking.tracking.lastLat,
            longitude: booking.tracking.lastLng,
            timestamp: booking.tracking.lastUpdatedAt || new Date()
          });
        }
      } catch (err) {
        console.error('Error joining booking room:', err);
      }
    });

    // 4. Location update event (with 3-5 sec throttling & no full history bloat)
    socket.on('location-update', async (data) => {
      const { bookingId, latitude, longitude, timestamp } = data;
      if (!bookingId || !latitude || !longitude) return;

      // Throttle: ignore if updated in the last 4 seconds
      const lastUpdate = locationThrottler.get(bookingId);
      const now = Date.now();
      if (lastUpdate && (now - lastUpdate < 4000)) {
        return; // drop update
      }
      locationThrottler.set(bookingId, now);

      try {
        const booking = await Booking.findById(bookingId).populate('customer', 'lat lng locationPoint address');
        if (!booking) return;

        // Ensure ONLY the assigned worker is emitting this
        if (booking.worker?.toString() !== socket.user.userId) {
          return; // unauthorized emit
        }

        const safePayload = {
          latitude: Number(latitude),
          longitude: Number(longitude),
          timestamp: timestamp || new Date().toISOString()
        };

        // Broadcast to the room (Customer receives this)
        io.to(`booking:${bookingId}`).emit('worker-location', safePayload);

        // Update booking lastKnownLocation (no historical bloat)
        booking.tracking = {
          ...booking.tracking,
          isActive: booking.status === 'EnRoute',
          lastLat: safePayload.latitude,
          lastLng: safePayload.longitude,
          lastUpdatedAt: safePayload.timestamp
        };
        
        // 5. Calculate distance and auto-prompt "Mark as Arrived"
        if (booking.status === 'EnRoute' && booking.customer?.locationPoint?.coordinates) {
          const custLng = booking.customer.locationPoint.coordinates[0];
          const custLat = booking.customer.locationPoint.coordinates[1];
          const distanceMeters = getDistanceFromLatLonInMeters(safePayload.latitude, safePayload.longitude, custLat, custLng);

          if (distanceMeters <= 100) {
            // Suggest to worker (who emitted the location)
            socket.emit('suggest-arrived', { distanceMeters });
          }
        }

        await booking.save();
      } catch (err) {
        console.error('Error in location-update:', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      // 7. No tracking state dropped on disconnect, lastKnownLocation remains in DB
    });

    // Note: Kept standard WebRTC calls for Voice/Video below (unchanged, just migrated auth)
    socket.on('call-initiate', (data) => {
      const { receiverId } = data || {};
      if (!receiverId) return;
      io.to(`user-${receiverId}`).emit('incoming-call', { ...data, callerId: socket.user.userId });
    });
    socket.on('sdp-offer', (data) => io.to(`user-${data.targetId}`).emit('sdp-offer-received', { ...data, callerId: socket.user.userId }));
    socket.on('call-accepted', (data) => io.to(`user-${data.callerId}`).emit('call-answered', data));
    socket.on('ice-candidate', (data) => io.to(`user-${data.targetId}`).emit('ice-candidate-received', { ...data, senderId: socket.user.userId }));
    socket.on('reject-call', (data) => io.to(`user-${data.targetId}`).emit('call-rejected', data));
    socket.on('end-call', (data) => io.to(`user-${data.targetId}`).emit('call-ended', { message: 'Call ended' }));
  });
}

module.exports = initLocationSocket;
