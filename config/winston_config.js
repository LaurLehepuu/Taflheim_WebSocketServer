const winston = require('winston')
const basic_logger_transports = []

basic_logger_transports.push(
  new winston.transports.File({ filename: 'error.log', level: 'error' }),
  new winston.transports.File({ filename: 'combined.log' })
);

//Add logging to non production
if (process.env.NODE_ENV !== 'production') {
  basic_logger_transports.push(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

//Create logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: basic_logger_transports
});

module.exports = {
  logger
}
