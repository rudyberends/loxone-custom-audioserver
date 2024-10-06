import winston, { Logger, LeveledLogMethod } from 'winston';
import Transport, { TransportStreamOptions } from 'winston-transport';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Custom Logger Interface extending Winston Logger to add the "alert" log method
 * and a method to set file log level.
 */
interface TroxorLogger extends Logger {
  alert: LeveledLogMethod;
  setFileLogLevel(level: string): void;
}

// Define custom log levels, where 'alert' is a custom log level between 'error' and 'warn'
const LOG_LEVELS: Record<string, number> = {
  error: 0, // Highest priority
  alert: 1, // Custom level
  warn: 2,
  info: 3,
  debug: 4, // Lowest priority
};

/**
 * Log format definition that combines timestamp and custom message formatting.
 * Logs will appear in the format: [YYYY-MM-DD HH:mm:ss:ms][level] message.
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), // Adds a timestamp to each log
  winston.format.printf(
    (info) => `[${info.timestamp}][${info.level}]${info.message}` // Custom log message format
  ),
);

/**
 * Custom transport class for sending notifications when 'alert' or 'error' level logs are created.
 * This transport can be extended to send email, Slack, or other types of alerts.
 */
class NotificationTransport extends Transport {
  name: string;

  /**
   * Constructor for the custom NotificationTransport.
   * @param opts Optional transport options from Winston.
   */
  constructor(opts?: TransportStreamOptions) {
    super(opts);
    this.name = 'NotificationTransport'; // Set the transport name
  }

  /**
   * The `log` method is required by all custom transports.
   * It emits a 'logged' event asynchronously and handles custom notification logic.
   * @param info The log information object containing level and message.
   * @param callback A callback function to be invoked after logging is complete.
   */
  log(info: any, callback: () => void) {
    // Emit the 'logged' event to indicate that logging was processed
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Here, you could add logic to send notifications via email, webhooks, etc.

    // Call the callback once the log entry is processed
    callback();
  }
}

// Create an instance of the custom NotificationTransport
const notificationTransport = new NotificationTransport();

/**
 * Initialize the Winston logger with custom levels, formats, and transports.
 * The logger writes to the console and a file, and includes the custom alert level.
 */
const logger = winston.createLogger({
  level: 'debug', // Default log level is 'debug', but can be overridden by environment variables
  levels: LOG_LEVELS, // Use custom log levels including 'alert'
  format: logFormat,  // Apply custom log format
  transports: [
    new winston.transports.Console({
      level: process.env.LOGLEVEL_CONSOLE || 'none', // Console logging level set via .env
    }),
    new winston.transports.File({
      filename: 'log/troxor.log', // Log file location
      level: process.env.LOGLEVEL_FILE || 'none', // File logging level set via .env
    }),
    notificationTransport, // Use the custom notification transport
  ] as winston.transport[], // Type assertion for the transport array
}) as unknown as TroxorLogger; // Cast to TroxorLogger interface to include custom methods

/**
 * Adds a custom 'alert' logging method to the logger.
 * This method allows logging at the 'alert' level, providing functionality similar to other log levels.
 * 
 * @param message The log message (either string or object).
 * @param meta Optional additional metadata for logging.
 */
logger.alert = ((message: string | object, meta?: any) => {
  // If the message is a string, log the message with 'alert' level
  if (typeof message === 'string') {
    logger.log('alert', message, meta);
  } else {
    // If the message is an object, log it with empty message but include the object as metadata
    logger.log('alert', '', message);
  }
}) as LeveledLogMethod;

export default logger;
