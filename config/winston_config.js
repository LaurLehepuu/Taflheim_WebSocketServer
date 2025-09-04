const winston = require('winston')
const basic_logger_transports = []

// File transports with JSON format
basic_logger_transports.push(
  new winston.transports.File({ 
    filename: 'error.log', 
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  }),
  new winston.transports.File({ 
    filename: 'combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  })
);

//Add logging to non production with custom format
if (process.env.NODE_ENV !== 'production') {
  basic_logger_transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    )
  }));
}

//Create logger
const logger = winston.createLogger({
  transports: basic_logger_transports
});

module.exports = {
    logger
}
