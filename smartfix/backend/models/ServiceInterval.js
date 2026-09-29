const mongoose = require('mongoose');

const serviceIntervalSchema = new mongoose.Schema({
  category: { type: String, required: true },
  subService: { type: String, required: true },
  recommendedIntervalDays: { type: Number, required: true },
});

const ServiceInterval = mongoose.model('ServiceInterval', serviceIntervalSchema);

// Seed data logic
const seedServiceIntervals = async () => {
  const count = await ServiceInterval.countDocuments();
  if (count === 0) {
    const seedData = [
      // AC Service is usually done every 90-120 days
      { category: 'AC Service', subService: 'AC Deep Cleaning', recommendedIntervalDays: 120 },
      { category: 'AC Service', subService: 'AC Gas Refill', recommendedIntervalDays: 365 },
      
      // Water Purifier / RO Service is usually done every 180 days
      { category: 'Water Purifier Service', subService: 'RO Complete Service', recommendedIntervalDays: 180 },
      { category: 'Water Purifier Service', subService: 'Filter Replacement', recommendedIntervalDays: 180 },
      
      // Washing Machine Repair - largely reactive, longer interval
      { category: 'Washing Machine Repair', subService: 'General Checkup', recommendedIntervalDays: 270 },
      
      // Refrigerator Repair
      { category: 'Refrigerator Repair', subService: 'Cooling Issue Servicing', recommendedIntervalDays: 270 },
    ];
    
    await ServiceInterval.insertMany(seedData);
    console.log('🌱 ServiceInterval seed data initialized.');
  }
};

module.exports = { ServiceInterval, seedServiceIntervals };
