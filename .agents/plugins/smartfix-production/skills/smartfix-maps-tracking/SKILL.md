---
name: smartfix-maps-tracking
description: SmartFix geolocation and real-time Socket.IO tracking skill for provider location broadcasting and customer map visualization.
---

# SmartFix Maps & Tracking Skill

## Socket.IO Real-Time Protocol

### 1. Connection & Room Join
- Customer joins booking room: `socket.emit('join-booking-room', { bookingId })`.
- Worker joins booking room: `socket.emit('join-booking-room', { bookingId })`.

### 2. Location Broadcast
- Provider app retrieves device GPS (`navigator.geolocation.watchPosition`).
- Provider app emits:
  ```js
  socket.emit('update-location', {
    workerId,
    bookingId,
    latitude,
    longitude
  });
  ```
- Backend broadcasts to booking room:
  ```js
  io.to(bookingId).emit('worker-location-changed', {
    latitude,
    longitude,
    timestamp: Date.now()
  });
  ```

### 3. Google Maps Component Integration
- `customer-app` & `frontend` render Google Map or Leaflet Map showing:
  - Customer Service Address Marker.
  - Live Moving Worker Marker.
  - Route / ETA polyline.
