const  winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', 
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  
    winston.format.errors({ stack: process.env.NODE_ENV !== 'production' }), 
    
    winston.format.json() 
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Output error logs to a file
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    // Output all logs to a combined file
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
  ],
});

// Export the logger to be used throughout the application
module.exports = logger;