# SmartFix Location System

## Architecture Overview

```
District (38 TN districts)
  └── Taluk (N per district)
        └── Village / Town / City (N per taluk)
```

All location data lives in the `Location` MongoDB collection with `level: "district" | "taluk" | "village"`.

---

## How to Obtain LGD CSVs

1. Go to **https://lgdirectory.gov.in** → Panchayat/Village Directory  
2. Select State: **Tamil Nadu** → District → Export CSV  
3. Rename to `backend/data/locations/tn/<district-slug>.csv`  
4. Ensure columns match: `taluk_en, taluk_ta, name_en, name_ta, kind, lat, lng, pincode`  
5. `kind` values: `village`, `town`, `city`

---

## How to Run seed:locations

```bash
# From backend/
npm run seed:locations

# Force in production (use with caution!)
NODE_ENV=production node scripts/seedLocations.js --force
```

**What it does:**
- Reads all 38 districts from `data/locations/districts.json`
- For each district, looks for `data/locations/tn/<slug>.csv`
- Upserts districts, taluks, and villages idempotently
- Districts with no CSV are set `isServiceActive: false`
- Districts WITH a CSV are set `isServiceActive: true`
- Prints per-district summary: taluks, villages, rows skipped

---

## How to Activate a District

**Via Admin Panel UI:**  
Admin Panel → Districts tab → toggle "Active" switch  
(Warning shown if district has 0 verified workers)

**Via API:**
```bash
PATCH /api/admin/locations/districts/:id/toggle-active
Authorization: Bearer <admin-token>
# With no workers present, first call returns requiresConfirmation: true
# Second call with body: { confirmActivation: true } proceeds
```

---

## Manual Test Cases

### 1. "pillaiyar koil pakkam" in Manamadurai
- Select District: Sivagangai  
- Select Taluk: Manamadurai  
- Select Village: any Manamadurai village  
- Free text: `pillaiyar koil pakkam`  
- Expected AI result: `landmark: "Near Pillayar Koil"`, mismatch: false  

### 2. Pin dragged across state border (e.g., Kerala)
- Drag pin to Kerala on map  
- Expected: Hard block — "Service available only in Tamil Nadu"  

### 3. Blank free text with dropdowns only
- Select District → Taluk → Village  
- Leave free text empty  
- Click "Locate on Map"  
- Expected: Uses village centroid, `needsPinAdjust: true`, user can drag  

### 4. Inactive district booking attempt
- Select any inactive district (marked "Coming Soon")  
- Expected: Waitlist screen shown, cannot proceed to booking  

### 5. Alias match (Tuticorin → Thoothukudi)
- Geocoded result returns "Tuticorin"  
- Selected district: "Thoothukudi" (alias: ["Tuticorin"])  
- Expected: Soft match accepted, `districtMismatchWarning: false`  

### 6. AI failure fallback
- Kill GROQ_API_KEY temporarily  
- Submit free text address  
- Expected: Template fallback used, `aiCleaned: false`, user not blocked  

### 7. Place mismatch detection
- Select Taluk: Devakottai, Village: Devakottai Town  
- Free text: "Karaikudi bus stand pakkam"  
- Expected: `mismatchWarning: true`, `mentionedPlace: "Karaikudi"`, bilingual prompt shown  

---

## Component Usage

```jsx
import LocationPicker from '../components/LocationPicker';

// Booking flow
<LocationPicker
  mode="booking"
  onConfirm={(structuredAddress) => {
    // structuredAddress has: districtId, talukId, villageId,
    // districtName, talukName, villageName, doorNo, street,
    // landmark, pincode, lat, lng, normalizedAddress, mapVerified
    setBookingAddress(structuredAddress);
  }}
/>

// Worker service area setup (multi-taluk, no free text)
<LocationPicker mode="worker" workerMode={true} onConfirm={handleWorkerArea} />
```

---

## API Reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/locations/districts` | None | All 38 districts (cached 24h) |
| GET | `/api/locations/districts/:id/taluks` | None | Taluks for a district |
| GET | `/api/locations/taluks/:id/villages?q=` | None | Village typeahead (min 2 chars) |
| POST | `/api/address/normalize` | JWT | AI clean + geocode + validate |
| POST | `/api/address/reverse` | JWT | Server-side reverse geocode |
| POST | `/api/address/confirm` | JWT | Final server-side re-validation |
| POST | `/api/waitlist` | JWT | Join waitlist for inactive district |
| GET | `/api/admin/locations/districts` | Admin | Districts management table |
| PATCH | `/api/admin/locations/districts/:id/toggle-active` | Admin | Activate/deactivate district |
| PATCH | `/api/admin/locations/taluks/:id` | Admin | Edit taluk radiusKm |
| POST | `/api/admin/locations/villages` | Admin | Add village manually |
| PATCH | `/api/admin/locations/villages/:id` | Admin | Edit/disable village |

---

## Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_HIERARCHY` | talukId not under districtId, or villageId not under talukId |
| `DISTRICT_NOT_ACTIVE` | Booking attempted for inactive district |

---

## Adding a New District's Data

1. Download CSV from lgdirectory.gov.in  
2. Format columns: `taluk_en, taluk_ta, name_en, name_ta, kind, lat, lng, pincode`  
3. Save as `backend/data/locations/tn/<district-slug>.csv`  
4. Run: `npm run seed:locations`  
5. District will auto-activate in DB  
6. Optionally activate via Admin Panel
