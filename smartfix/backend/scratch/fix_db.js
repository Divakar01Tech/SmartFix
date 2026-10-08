const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGO_URI).then(async () => {
  try {
    await mongoose.connection.collection('users').updateMany({googleUid: ''}, {$unset: {googleUid: 1}});
    console.log('Fixed googleUid empty strings');
    await mongoose.connection.collection('users').dropIndex('googleUid_1');
    console.log('Dropped googleUid_1 index');
  } catch (e) {
    console.log('Error or index not found:', e.message);
  }
  process.exit(0);
});
