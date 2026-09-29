const User = require('../models/User');

const defaultHandymen = [
  {
    name: 'Aswin S P',
    phone: '+919003390146',
    password: 'password123',
    role: 'handyman',
    trade: 'Plumbing',
    subServices: ['Tap Leakage Repair', 'Pipe Fitting', 'Water Tank Cleaning', 'Drainage Unclogging'],
    location: 'Sivagangai, Tamil Nadu',
    ratePerHour: 350,
    isOnline: true,
    isAvailable: true,
    verificationStatus: 'Verified',
  },
  {
    name: 'Handyman Expert Pro',
    phone: '+919787792998',
    password: 'password123',
    role: 'handyman',
    trade: 'Electrical Repairs',
    subServices: ['Wiring Installation', 'Switchboard Repair', 'Fan Fitting', 'MCB Tripping Repair'],
    location: 'Sivagangai, Tamil Nadu',
    ratePerHour: 350,
    isOnline: true,
    isAvailable: true,
    verificationStatus: 'Verified',
  },
  {
    name: 'Karthik AC Specialist',
    phone: '+919876543210',
    password: 'password123',
    role: 'handyman',
    trade: 'AC Service & Repair',
    subServices: ['Gas Charging', 'Filter Cleaning', 'Compressor Repair', 'AC Installation'],
    location: 'Karaikudi, Sivagangai',
    ratePerHour: 499,
    isOnline: true,
    isAvailable: true,
    verificationStatus: 'Verified',
  },
  {
    name: 'Senthil Washing Machine Pro',
    phone: '+919876543211',
    password: 'password123',
    role: 'handyman',
    trade: 'Washing Machine Repair',
    subServices: ['Drum Noise Fix', 'Water Leakage Repair', 'PCB Board Repair', 'Motor Replacement'],
    location: 'Devakottai, Sivagangai',
    ratePerHour: 399,
    isOnline: true,
    isAvailable: true,
    verificationStatus: 'Verified',
  },
  {
    name: 'Murugan Water Purifier Specialist',
    phone: '+919876543212',
    password: 'password123',
    role: 'handyman',
    trade: 'Water Purifier Service',
    subServices: ['RO Membrane Replacement', 'Filter Service', 'TDS Adjustment', 'Pump Repair'],
    location: 'Manamadurai, Sivagangai',
    ratePerHour: 299,
    isOnline: true,
    isAvailable: true,
    verificationStatus: 'Verified',
  },
  {
    name: 'Ramesh Fridge Repair Pro',
    phone: '+919876543213',
    password: 'password123',
    role: 'handyman',
    trade: 'Refrigerator Repair',
    subServices: ['Cooling Issue Repair', 'Thermostat Replacement', 'Gas Leak Repair', 'Door Gasket Fix'],
    location: 'Manamadurai, Sivagangai',
    ratePerHour: 450,
    isOnline: true,
    isAvailable: true,
    verificationStatus: 'Verified',
  },
];

const ensureDefaultHandymen = async () => {
  try {
    // Auto-seeding disabled upon user request to allow 100% clean testing of handyman registration flow
    console.log('ℹ️ Default handyman auto-seeding disabled. Ready for fresh provider registration testing.');
  } catch (err) {
    console.warn('⚠️ Handyman seeding warning:', err.message);
  }
};

module.exports = ensureDefaultHandymen;

