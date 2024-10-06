import logger from './utils/troxorlogger'; // Importing the custom logger
import { initializeConfig, config } from './config/config'; // Importing the config and initialize function
import { startWebServer } from './http/webserver'; // Import the web server start function

// Enum for server names to improve clarity and type safety
const enum ServerNames {
  AppHttp = 'AppHttp',
  MsHttp = 'msHttp',
}

let AppHttp: { shutdown: Function };
let MsHttp: { shutdown: Function };

// Validate environment variables to ensure necessary configurations are set
function validateEnvVariables() {
  if (!config.audioserver?.name) {
    throw new Error('AudioServer name is not defined in the configuration.'); // Ensure AudioServer name is defined
  }
}

/**
 * Initialize the application by loading the configuration and validating necessary variables.
 * @throws Will throw an error if the configuration is invalid.
 */
async function initializeAudioServer() {
  await initializeConfig(); // Load configuration from the environment
  validateEnvVariables(); // Validate the loaded configuration
  logger.info('[Main] Starting Loxone Audio Server Proxy');
  logger.info(`[Main] AudioServer Name: ${config.audioserver!.name}`); // Logging AudioServer name safely
}

/**
 * Start the web servers for the audio server proxy.
 */
function startWebServers() {

  AppHttp = startWebServer(7091, ServerNames.AppHttp); // Start AppHttp server on port 7091 (Used by clients)
  logger.info(`[Main] ${ServerNames.AppHttp} server started on port 7091.`);

  MsHttp = startWebServer(7095, ServerNames.MsHttp); // Start msHttp server on port 7095 (Used by the miniserver)
  logger.info(`[Main] ${ServerNames.MsHttp} server started on port 7095.`);
}

/**
 * Handle graceful shutdown of the application.
 * @param {string} signal - The signal received for shutdown (e.g., SIGINT, SIGTERM).
 */
function handleShutdown(signal: string) {
  logger.info(`[Main] Received shutdown signal: ${signal}. Shutting down gracefully.`);
  AppHttp.shutdown();
  MsHttp.shutdown();
  process.exit(0); // Exit the process cleanly
}

/**
 * Main function to start the application.
 * Initializes configuration, sets up zones, and starts the servers.
 */
async function startApplication() {
  try {
    await initializeAudioServer(); // Initialize application configuration
    startWebServers(); // Start the web servers
  } catch (error: unknown) {
    // Check if error is an instance of Error for type safety
    if (error instanceof Error) {
      logger.error('[Main] Error during initialization or setup:', error.message); // Log the error message
    } else {
      logger.error('[Main] Unknown error during initialization or setup.'); // Handle unknown errors
    }
    process.exit(1); // Exit the process with a failure code
  }
}

// Setup signal listeners for graceful shutdown
process.on('SIGINT', () => handleShutdown('SIGINT')); // Handle interrupt signal (Ctrl+C)
process.on('SIGTERM', () => handleShutdown('SIGTERM')); // Handle termination signal

// Start the application
startApplication();
