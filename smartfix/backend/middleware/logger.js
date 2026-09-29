const winston = require('winston');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Winston Application & Error Logger
const winstonLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  winstonLogger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Morgan HTTP Stream
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });
const httpLogger = morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: accessLogStream,
});

// Express Error Handler Middleware (Winston)
const errorHandler = (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  
  // Sanitize sensitive fields before logging
  const sanitizedBody = { ...req.body };
  delete sanitizedBody.password;
  delete sanitizedBody.otpCode;
  delete sanitizedBody.aadhaarNumber;
  delete sanitizedBody.idProofNumber;

  winstonLogger.error({
    message: err.message,
    status,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    user: req.user?.id || 'anonymous',
    body: sanitizedBody,
    timestamp: new Date().toISOString(),
  });

  res.status(status).json({
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

module.exports = {
  winstonLogger,
  httpLogger,
  errorHandler,
};
