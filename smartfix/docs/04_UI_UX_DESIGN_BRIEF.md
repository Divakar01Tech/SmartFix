# SMARTFIX — UI/UX DESIGN BRIEF

**Project Name**: SmartFix / SmartFix Platform  
**Document Version**: 1.0.0  

---

## 1. Design Aesthetics & Core Design Tokens

- **Theme Palette**:
  - Primary Action / Accent: Vibrant Indigo / Royal Blue (`#3b82f6`, `#2563eb`)
  - Success & Online State: Emerald Green (`#10b981`, `#059669`)
  - Warning / Active Alert: Amber (`#f59e0b`)
  - Neutral Light Background: `#f8fafc`
  - Neutral Dark Background: `#0f172a` (Data-Theme supported)
- **Typography**: Google Fonts Inter / Outfit for high legibility across mobile screens.
- **Glassmorphism & Shadows**: Sleek backdrop blurs, soft card elevations (`shadow-sm`, `shadow-md`).

---

## 2. Key Screen Specifications

### 2.1 Navigation Bar & Top Header
- **Pill-Style Language Selector**: `EN` | `தமிழ்` toggle button group.
- **Theme Toggle**: Light / Dark mode moon & sun button.
- **Role-Based Dropdown Menu**: Click-triggered user profile menu displaying role badge (`Handyman Service`, `Customer`, `System Admin`).

### 2.2 Home & Service Browse Pages (`/`, `/browse`)
- **Hero Banner**: "Instant 15-Min On-Demand Dispatch" badge + quick search bar.
- **Service Categories Grid**: 6 primary trade cards (Plumbing, Electrical, AC Service, Washing Machine, Water Purifier, Refrigerator).
- **Worker Cards**:
  - Avatar emoji / image, worker name, verified check badge, trade category, hourly rate (₹/hr), distance (km), and online status pill.

### 2.3 Interactive Booking & Dispatch Screen (`/booking/:workerId`)
- **Service Tier Selector**:
  - BikePro Express ⚡ (15–20 mins)
  - AutoHandyman Standard 🚗 (25 mins)
  - MasterTech Specialist 🚚 (Tools included)
- **Location Picker Map**: Leaflet interactive map with pin placement for door number and street address.
- **Fare Breakdown Summary**: Upfront fare display including base charge, distance fee, and total estimated price.

### 2.4 Handyman Dashboard (`/handyman-dashboard`)
- **Availability Toggle**: Large switch for Online 🟢 / Offline 🔴 status.
- **Dispatch Alert Modal**: Floating 30-second countdown popup with sound synthesized ringtone, job location, sub-services, and Accept/Decline actions.
- **Live GPS Tracking Component**: Leaflet / Google Maps showing real-time position breadcrumbs.
- **Wallet & Payout Modal**: Tabbed view showing current wallet balance, UPI ID input, and direct bank withdrawal form.

### 2.5 Admin Console (`/admin`)
- **Metric Summary Cards**: Total active captains, verified workers, registered customers, total revenue, platform commission.
- **Verification Queue**: Document preview card displaying Aadhaar number, uploaded image, with Approve / Reject controls.
