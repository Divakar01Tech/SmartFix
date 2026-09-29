# SmartFix / HandyBook Workspace Rules

## Core System Architecture & Guidelines
This workspace contains the full-stack MERN (MongoDB, Express, React, Node.js) implementation of SmartFix / HandyBook home service booking platform.

### 1. Multi-Role Authorization & Security
- **Roles**: `Customer`, `Worker` (Provider), `Admin`.
- **JWT Authentication**: Always enforce server-side role validation in middleware (`protect`, `authorizeRole`). Never trust client-side role claims.
- **Worker Verification**: Workers must undergo admin KYC approval (ID proof, certificate verification) before appearing in search results or receiving booking requests.
- **Data Privacy**: Passwords must be hashed with `bcryptjs`. Sensitive fields (passwords, tokens, OTPs) must be excluded from API query responses by default.

### 2. Geographic & Service Scoping
- **Primary Region**: Sivagangai District, Tamil Nadu, India.
- **Coordinates & Spatial Queries**: Use MongoDB `2dsphere` indexes on GeoJSON Point fields (`location.coordinates: [longitude, latitude]`).
- **Google Maps Integration**: Calculate driving distances and estimated arrival times using Google Maps Distance Matrix API or haversine formulas fallback.

### 3. Worker Recommendation Engine (AI Integration)
- **AI Scoring**: Gemini API scores candidate workers based on:
  - Distance (Sivagangai area proximity)
  - Rating & Completed Jobs count
  - Availability & Current Status (`online`, `available`)
  - Service Category match & Response speed
- **Business Rule Enforcement**: Backend rules ALWAYS override AI outputs. Unverified or offline workers must be excluded regardless of AI score.

### 4. Real-time Communication & Worker Tracking
- **Socket.IO**: Real-time worker position updates (`worker:location-update`), live booking notifications (`booking:assigned`, `booking:status-changed`), and in-app chat.
- **Tracking Logic**: Emit periodic lat/lng updates from provider app only when worker is on active duty or heading to job location.

### 5. Financial & Payment Safety
- **Razorpay Payments**: Create order on server side -> complete payment on client -> verify Razorpay signature (`razorpay_signature`) on server side before marking booking as `paid`.
- **Idempotency**: Prevent duplicate booking payment processing.

### 6. Code Style & Environment Safety
- All environment secrets (`JWT_SECRET`, `MONGODB_URI`, `RAZORPAY_KEY_SECRET`, `TWILIO_AUTH_TOKEN`, `GEMINI_API_KEY`) MUST be loaded via `process.env`.
- Frontend code must use React 18/19 patterns with proper error boundaries, loading states, and clean CSS/Tailwind styling.
