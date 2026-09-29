const mongoose = require('mongoose');
const dns = require('dns');

let isConnected = false;

// Set up connection event monitoring
mongoose.connection.on('connected', () => {
  isConnected = true;
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  console.error(`⚠️ MongoDB Connection Issue: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️ MongoDB Disconnected. Waiting for reconnection...');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('✅ MongoDB Reconnected successfully.');
});

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const primaryUri = (process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartfix').trim();
  const localFallbackUri = 'mongodb://127.0.0.1:27017/smartfix';

  // Apply public DNS only for Atlas SRV connection strings to fix Windows querySrv ECONNREFUSED
  if (primaryUri.startsWith('mongodb+srv://')) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
    } catch (e) {
      // Ignore if restricted
    }
  }

  if (primaryUri.includes('<db_password>')) {
    console.warn('\n===============================================================');
    console.warn('⚠️  MONGODB ATLAS CONNECTION NOTICE:');
    console.warn('Please replace <db_password> in backend/.env with your actual database password.');
    console.warn('===============================================================\n');
    return null;
  }

  let conn = null;

  // 1. Try Primary Connection
  try {
    const isPrimaryLocal = primaryUri.includes('127.0.0.1') || primaryUri.includes('localhost');
    conn = await mongoose.connect(primaryUri, {
      family: 4,
      serverSelectionTimeoutMS: 5000,
      ...(isPrimaryLocal ? { directConnection: true } : {}),
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (primaryErr) {
    console.error(`❌ Primary MongoDB Connection Error: ${primaryErr.message}`);

    // 2. Try Fallback if primary is not already local
    if (primaryUri !== localFallbackUri && !primaryUri.includes('127.0.0.1')) {
      console.log('🔄 Attempting fallback to local MongoDB (mongodb://127.0.0.1:27017/smartfix)...');
      try {
        conn = await mongoose.connect(localFallbackUri, {
          family: 4,
          directConnection: true,
          serverSelectionTimeoutMS: 3000,
        });
        console.log(`✅ Local MongoDB Fallback Connected: ${conn.connection.host}`);
      } catch (fallbackErr) {
        console.error(`❌ Local MongoDB Fallback Error: ${fallbackErr.message}`);
      }
    }
  }

  // 3. Post-connection operations or guidance
  if (mongoose.connection.readyState === 1) {
    try {
      const seedHandymen = require('./seed');
      await seedHandymen();
    } catch (seedErr) {
      console.warn('⚠️ Database seed notice:', seedErr.message);
    }
    return conn;
  }

  console.warn('\n===============================================================');
  console.warn('⚠️  MONGODB CONNECTION REQUIRED:');
  console.warn('1. For Atlas: Whitelist IP on Atlas Dashboard -> Security -> Network Access -> Allow Access From Anywhere (0.0.0.0/0)');
  console.warn('2. For Local: Ensure MongoDB service is running on 127.0.0.1:27017');
  console.warn('===============================================================\n');

  return null;
};

module.exports = connectDB;

