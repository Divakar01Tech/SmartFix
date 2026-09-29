const mongoose = require('mongoose');

const servicePricingSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
  },
  subService: {
    type: String,
    required: true,
  },
  minPrice: {
    type: Number,
    required: true,
  },
  maxPrice: {
    type: Number,
    required: true,
  },
  avgDurationMinutes: {
    type: Number,
    default: 60,
  }
}, { timestamps: true });

const ServicePricing = mongoose.model('ServicePricing', servicePricingSchema);

// Initial Seed Data (6 Categories x 8 Sub-services = 48 combos for Sivagangai typical rates)
const seedData = [
  // Plumbing
  { category: 'Plumbing', subService: 'Leaking Tap / Valve Replacement', minPrice: 150, maxPrice: 350, avgDurationMinutes: 30 },
  { category: 'Plumbing', subService: 'Drain Blockage Clearing', minPrice: 300, maxPrice: 600, avgDurationMinutes: 60 },
  { category: 'Plumbing', subService: 'Overhead Tank Cleaning', minPrice: 500, maxPrice: 800, avgDurationMinutes: 120 },
  { category: 'Plumbing', subService: 'Motor Pump Repair', minPrice: 400, maxPrice: 1500, avgDurationMinutes: 90 },
  { category: 'Plumbing', subService: 'Geyser Water Leak', minPrice: 300, maxPrice: 600, avgDurationMinutes: 60 },
  { category: 'Plumbing', subService: 'Toilet Flush Repair', minPrice: 200, maxPrice: 450, avgDurationMinutes: 45 },
  { category: 'Plumbing', subService: 'Pipe Burst / Major Leak', minPrice: 500, maxPrice: 2000, avgDurationMinutes: 120 },
  { category: 'Plumbing', subService: 'New Tap/Shower Installation', minPrice: 150, maxPrice: 400, avgDurationMinutes: 45 },
  // Electrical
  { category: 'Electrical', subService: 'MCB Tripping Issue', minPrice: 200, maxPrice: 500, avgDurationMinutes: 45 },
  { category: 'Electrical', subService: 'Ceiling Fan Repair', minPrice: 150, maxPrice: 350, avgDurationMinutes: 40 },
  { category: 'Electrical', subService: 'Switchboard Repair/Replacement', minPrice: 150, maxPrice: 400, avgDurationMinutes: 30 },
  { category: 'Electrical', subService: 'Wiring Short Circuit', minPrice: 400, maxPrice: 1500, avgDurationMinutes: 120 },
  { category: 'Electrical', subService: 'Inverter/Battery Connection', minPrice: 300, maxPrice: 800, avgDurationMinutes: 60 },
  { category: 'Electrical', subService: 'Tube Light / LED Fitting', minPrice: 100, maxPrice: 250, avgDurationMinutes: 30 },
  { category: 'Electrical', subService: 'Main Board / Meter Issue', minPrice: 500, maxPrice: 2000, avgDurationMinutes: 90 },
  { category: 'Electrical', subService: 'Geyser Electrical Fault', minPrice: 250, maxPrice: 600, avgDurationMinutes: 60 },
  // AC Service & Repair
  { category: 'AC Service & Repair', subService: 'AC Water Leakage Indoors', minPrice: 400, maxPrice: 800, avgDurationMinutes: 60 },
  { category: 'AC Service & Repair', subService: 'AC Gas Refill (R32/R410A)', minPrice: 1500, maxPrice: 2500, avgDurationMinutes: 90 },
  { category: 'AC Service & Repair', subService: 'AC General Water Wash', minPrice: 400, maxPrice: 600, avgDurationMinutes: 45 },
  { category: 'AC Service & Repair', subService: 'AC Deep Chemical Wash', minPrice: 700, maxPrice: 1000, avgDurationMinutes: 90 },
  { category: 'AC Service & Repair', subService: 'AC Not Cooling / Compressor Issue', minPrice: 500, maxPrice: 3000, avgDurationMinutes: 120 },
  { category: 'AC Service & Repair', subService: 'AC Installation / Dismantling', minPrice: 1000, maxPrice: 1800, avgDurationMinutes: 120 },
  { category: 'AC Service & Repair', subService: 'AC Capacitor Replacement', minPrice: 350, maxPrice: 600, avgDurationMinutes: 45 },
  { category: 'AC Service & Repair', subService: 'AC PCB Board Repair', minPrice: 1000, maxPrice: 2500, avgDurationMinutes: 120 },
  // Refrigerator
  { category: 'Refrigerator Repair', subService: 'Fridge Not Cooling', minPrice: 400, maxPrice: 2500, avgDurationMinutes: 90 },
  { category: 'Refrigerator Repair', subService: 'Gas Charging', minPrice: 1200, maxPrice: 2200, avgDurationMinutes: 120 },
  { category: 'Refrigerator Repair', subService: 'Compressor Replacement', minPrice: 3000, maxPrice: 5000, avgDurationMinutes: 150 },
  { category: 'Refrigerator Repair', subService: 'Defrost Issue / Ice Build-up', minPrice: 400, maxPrice: 900, avgDurationMinutes: 60 },
  { category: 'Refrigerator Repair', subService: 'Door Gasket Replacement', minPrice: 350, maxPrice: 700, avgDurationMinutes: 45 },
  { category: 'Refrigerator Repair', subService: 'Relay/Overload Fault', minPrice: 250, maxPrice: 500, avgDurationMinutes: 45 },
  { category: 'Refrigerator Repair', subService: 'Water Leakage', minPrice: 200, maxPrice: 500, avgDurationMinutes: 45 },
  { category: 'Refrigerator Repair', subService: 'PCB Repair', minPrice: 800, maxPrice: 2000, avgDurationMinutes: 120 },
  // Washing Machine
  { category: 'Washing Machine Repair', subService: 'Not Spinning / Drum Issue', minPrice: 400, maxPrice: 1500, avgDurationMinutes: 90 },
  { category: 'Washing Machine Repair', subService: 'Water Not Draining', minPrice: 300, maxPrice: 800, avgDurationMinutes: 60 },
  { category: 'Washing Machine Repair', subService: 'Water Inlet Valve Issue', minPrice: 300, maxPrice: 700, avgDurationMinutes: 45 },
  { category: 'Washing Machine Repair', subService: 'Motor Replacement', minPrice: 1500, maxPrice: 3500, avgDurationMinutes: 120 },
  { category: 'Washing Machine Repair', subService: 'PCB/Panel Repair', minPrice: 800, maxPrice: 2500, avgDurationMinutes: 120 },
  { category: 'Washing Machine Repair', subService: 'Suspension / Heavy Vibration', minPrice: 400, maxPrice: 1000, avgDurationMinutes: 60 },
  { category: 'Washing Machine Repair', subService: 'Door Lock Assembly', minPrice: 350, maxPrice: 800, avgDurationMinutes: 45 },
  { category: 'Washing Machine Repair', subService: 'General Deep Cleaning', minPrice: 400, maxPrice: 800, avgDurationMinutes: 90 },
  // Water Purifier
  { category: 'Water Purifier Service', subService: 'RO General Service (Filter Change)', minPrice: 400, maxPrice: 1500, avgDurationMinutes: 60 },
  { category: 'Water Purifier Service', subService: 'RO Membrane Replacement', minPrice: 800, maxPrice: 2500, avgDurationMinutes: 60 },
  { category: 'Water Purifier Service', subService: 'Motor/Pump Repair', minPrice: 600, maxPrice: 1800, avgDurationMinutes: 60 },
  { category: 'Water Purifier Service', subService: 'Water Leakage Repair', minPrice: 200, maxPrice: 500, avgDurationMinutes: 45 },
  { category: 'Water Purifier Service', subService: 'UV/UF Lamp Replacement', minPrice: 300, maxPrice: 800, avgDurationMinutes: 45 },
  { category: 'Water Purifier Service', subService: 'New RO Installation', minPrice: 400, maxPrice: 800, avgDurationMinutes: 90 },
  { category: 'Water Purifier Service', subService: 'TDS Adjustment', minPrice: 150, maxPrice: 300, avgDurationMinutes: 30 },
  { category: 'Water Purifier Service', subService: 'Tank Cleaning', minPrice: 200, maxPrice: 400, avgDurationMinutes: 45 }
];

// Initialize collection with seed data if empty
ServicePricing.countDocuments({}).then(count => {
  if (count === 0) {
    ServicePricing.insertMany(seedData)
      .then(() => console.log('ServicePricing seeded with 48 combos'))
      .catch(err => console.error('Error seeding ServicePricing:', err));
  }
}).catch(console.error);

module.exports = ServicePricing;
