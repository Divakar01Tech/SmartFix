const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // First, let's drop the index if it exists so we can update freely
    try {
      await db.collection('users').dropIndex('currentLocation_2dsphere');
      console.log('Dropped currentLocation_2dsphere index');
    } catch (e) {
      console.log('Index not found or could not drop:', e.message);
    }
    
    // Then clean up ALL documents that have currentLocation but no coordinates
    const result = await db.collection('users').updateMany(
      { 'currentLocation.coordinates': { $exists: false } },
      { $unset: { currentLocation: '' } }
    );
    console.log('Cleanup result:', result);
    
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
