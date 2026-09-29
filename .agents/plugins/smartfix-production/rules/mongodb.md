# MongoDB & Mongoose Modeling Rules

## GeoJSON & Spatial Indexing
- Geolocation fields must strictly conform to GeoJSON Point format:
  ```json
  "location": {
    "type": { "type": "String", "enum": ["Point"], "default": "Point" },
    "coordinates": [longitude, latitude] // Note: longitude comes FIRST in GeoJSON!
  }
  ```
- Ensure 2dsphere index is defined on location fields for spatial queries (`$near`, `$geoWithin`).

## Core Collections
1. **Users**: Shared authentication collection storing email, phone, hashed password, role (`customer`, `worker`, `admin`), and profile info.
2. **Workers**: Extended worker profile storing skills/categories, KYC documents, approval status, rating, completed jobs count, and current location.
3. **Bookings**: Tracks service bookings (customer ID, worker ID, service category, address, schedule, status, price, payment details).
4. **Services**: Service categories offered (category name, description, base price, icon, active status).
5. **Reviews**: Customer feedback and star ratings linked to completed bookings.
6. **Payments**: Payment audit logs (booking ID, Razorpay order ID, payment ID, amount, status, timestamp).

## Guidelines
- Always use Mongoose timestamps (`{ timestamps: true }`) for auditability.
- Provide sensible defaults for enum fields.
- Index foreign key fields (`userId`, `workerId`, `customerId`, `bookingId`) for query performance.
