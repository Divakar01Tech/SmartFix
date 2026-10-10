const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const initLocationSocket = require('./socket/locationSocket');
const { initSlaBreachCron } = require('./services/slaCronService');
const { initRebookingCron } = require('./jobs/rebookingReminders');
const { seedServiceIntervals } = require('./models/ServiceInterval');
const { initProxyCron } = require('./services/proxyCronService');
const { initDispatchSweeper } = require('./services/dispatchService');
const { initReviewSummaryCron } = require('./services/reviewSummaryService');
const { initWhatsApp } = require('./services/whatsappService');

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Fixes ERR_ERL_KEY_GEN_IPV6 for rate limiter

const USE_HTTPS = process.env.USE_HTTPS === 'true';
const certPath = path.join(__dirname, 'certs', 'cert.pem');
const keyPath = path.join(__dirname, 'certs', 'key.pem');

let server;
let protocol = 'http';

if (USE_HTTPS && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const sslOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  };
  server = https.createServer(sslOptions, app);
  protocol = 'https';
  console.log('🔒 HTTPS (SSL/TLS) Server Mode Enabled');
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

const { httpLogger, errorHandler } = require('./middleware/logger');
const { apiRateLimiter } = require('./middleware/rateLimiter');

app.use(cors());
app.use(express.json());
app.use(httpLogger);
app.set('io', io);



app.get('/', (req, res) => {
  res.send('SmartFix API & Socket.IO server is running...');
});

app.use('/invoices', express.static(path.join(__dirname, 'invoices')));

// Database readiness guard for all /api endpoints
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database is connecting or currently unavailable. Please try again shortly.',
    });
  }
  next();
});

app.use('/api', apiRateLimiter);

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/otp', require('./routes/otpRoutes'));
app.use('/api/services', require('./routes/serviceRoutes'));
app.use('/api/workers', require('./routes/workerRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/address', require('./routes/addressRoutes'));
app.use('/api/location', require('./routes/locationRoutes'));
app.use('/api/locations', require('./routes/locationRoutes')); // /api/locations/districts etc.
app.use('/api/waitlist', require('./routes/waitlistRoutes'));
app.use('/api/maps', require('./routes/mapsRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/dispatch', require('./routes/dispatchRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/sos', require('./routes/sosRoutes'));
app.use('/api/interview', require('./routes/interviewRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/commission', require('./routes/commissionRoutes'));
app.use('/api/twilio', require('./routes/twilioRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/disputes', require('./routes/disputeRoutes'));
app.use('/api/assistant', require('./routes/assistantRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/nearby-workers', require('./routes/nearbyWorkersRoutes'));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Handle port-in-use error gracefully
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use!`);
    console.error(`   Run this command to free it:  npx kill-port ${PORT}`);
    console.error(`   Then restart:                 npm run dev\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

const startServer = async () => {
  try {
    await connectDB();
    await seedServiceIntervals();
    
    // Initialize WebSocket Location Tracking & SLA Breach Sweeper after DB is connected
    initLocationSocket(io);
    initSlaBreachCron(io);
    initRebookingCron(io);
    initProxyCron();
    initDispatchSweeper(io);
    initReviewSummaryCron();
    
    // Initialize Free WhatsApp Web Client
    // initWhatsApp(); // Disabled for Render deployment as it requires Google Chrome and ephemeral storage will clear the session
  } catch (err) {
    console.error('Initial DB connection failure:', err.message);
  }
  // SmartFix Express & Socket.IO Server (HTTPS / HTTP auto-switching)
  server.listen(PORT, HOST, () => console.log(`✅ SmartFix Server & Socket.IO running on ${protocol}://${HOST}:${PORT}`));
};

startServer();
