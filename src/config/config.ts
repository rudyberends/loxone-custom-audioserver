import axios from 'axios'; // Import axios for making HTTP requests
import logger from '../utils/troxorlogger'; // Importing your custom logger
import { asyncCrc32 } from '../utils/crc32utils'; // Importing asynchronous CRC32 utility for checksum calculation
import dotenv from 'dotenv'; // Import dotenv to manage environment variables
import { setupZones } from '../backend/zonemanager';

// Load environment variables from the .env file
dotenv.config();

// Define the structure for MiniServer configuration
interface MiniServerConfig {
  ip: string; // IP address of the MiniServer
  mac: string; // MAC address of the MiniServer
  username: string; // Username for authentication
  password: string; // Password for authentication
}

// Define the structure for AudioServer configuration
interface AudioServerConfig {
  name: string; // Name of the audio server
  paired: boolean; // Indicates if the audio server is paired with the MiniServer
  ip: string; // IP of the audio server
  mac: string; // MAC address of the audio server
  macID: string; // MAC ID of the audio server in a specific format
  uuid?: string; // Optional UUID property of the audio server
  musicCFG?: any; // Music configuration data
  musicCRC?: string; // CRC value of the music configuration
}

// Define the structure for the overall configuration
interface Config {
  miniserver: MiniServerConfig; // Configuration for the MiniServer
  audioserver?: AudioServerConfig; // Configuration for the AudioServer, initially optional
}

// Create the config object and initialize it with environment variables
const config: Config = {
  miniserver: {
    ip: process.env.MINISERVER_IP || '', // MiniServer IP from the environment variable
    mac: '', // Placeholder for MiniServer MAC address
    username: process.env.MINISERVER_USERNAME || '', // MiniServer username from environment variable
    password: process.env.MINISERVER_PASSWORD || '', // MiniServer password from environment variable
  },
};

// Constants for default AudioServer values
const DEFAULT_AUDIO_SERVER: AudioServerConfig = {
  name: 'Unconfigured', // Default name when the AudioServer is not configured
  paired: false, // Default pairing status
  ip: process.env.AUDIOSERVER_IP || '', // We need this for the image-proxy.
  mac: '50:4f:94:ff:1b:b3', // Default MAC address for the audio server
  macID: '504F94FF1BB3', // Default MAC ID for the audio server
  musicCFG: '[]', // Empty Config
  musicCRC: 'd4cbb29' // Empty Config
};

/**
 * Handles Axios errors and logs the appropriate messages.
 *
 * @param {unknown} error - The error object caught in a try/catch block.
 */
const handleAxiosError = (error: unknown) => {
  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    switch (status) {
      case 401:
        logger.error('[config][getAudioserverConfig] Authentication failed: Unauthorized (401)');
        break;
      case 403:
        logger.error('[config][getAudioserverConfig] Authentication failed: Forbidden (403)');
        break;
      default:
        logger.error(`[config][getAudioserverConfig] Request failed with status: ${status}`);
    }
  } else if (error instanceof Error) {
    logger.error('Error fetching audio server config:', error.message);
  } else {
    logger.error('Error fetching audio server config: Unknown error');
  }
};

/**
 * Downloads the AudioServer configuration from the MiniServer.
 * This function makes an HTTP request to the MiniServer to retrieve the Music.json file.
 *
 * @returns {Promise<any>} The downloaded AudioServer configuration data (Music.json).
 */
const downloadAudioServerConfig = async (): Promise<any> => {
  try {
    logger.info(
      `[config][downloadAudioServerConfig] Fetching AudioServer config from Loxone MiniServer [${config.miniserver.ip}]`
    );

    // Create Basic Auth token using the MiniServer credentials
    const encodedBase64Token = Buffer.from(`${config.miniserver.username}:${config.miniserver.password}`).toString(
      'base64'
    );
    const authorization = `Basic ${encodedBase64Token}`;

    // Retrieve Music.json from MiniServer
    const response = await axios({
      url: `http://${config.miniserver.ip}/dev/fsget/prog/Music.json`,
      method: 'get',
      headers: { Authorization: authorization },
    });

    return response.data; // Return the fetched AudioServer configuration
  } catch (error) {
    handleAxiosError(error);
    throw new Error('Failed to download AudioServer configuration');
  }
};

/**
 * Processes the downloaded AudioServer configuration.
 * This function updates the configuration object and calculates the CRC.
 *
 * @param {any} audioServerConfigData - The downloaded configuration data from the MiniServer.
 * @returns {Promise<AudioServerConfig | null>} The updated AudioServer config or null if no AudioServer is found.
 */
const processAudioServerConfig = async (audioServerConfigData: any): Promise<AudioServerConfig | null> => {
  try {
    // Calculate the new CRC for the downloaded configuration
    const newMusicCRC = await asyncCrc32(JSON.stringify(audioServerConfigData));

    // Check if the CRC has changed
    if (newMusicCRC === config.audioserver?.musicCRC) {
      logger.info('[config][processAudioServerConfig] No changes detected in AudioServer config.');
      return config.audioserver; // No changes, return the existing config
    }

    // Initialize or update the audioserver in the config
    config.audioserver = { ...DEFAULT_AUDIO_SERVER, musicCFG: audioServerConfigData };
    config.audioserver.musicCRC = newMusicCRC; // Update the stored CRC

    // Check if AudioServer configuration is empty
    if (!config.audioserver.musicCFG || Object.keys(config.audioserver.musicCFG).length === 0) {
      logger.error('[config][processAudioServerConfig] No AudioServer found in config. AudioServer not paired.');
      return null; // Return null to indicate failure
    }

    config.audioserver.paired = true; // Mark the AudioServer as paired

    // Extract information from musicCFG
    for (const [, value] of Object.entries(config.audioserver.musicCFG)) {
      const audioServerEntry = value as { [key: string]: { master: string; name: string; uuid: string } };

      if (audioServerEntry[config.audioserver.macID]) {
        config.miniserver.mac = audioServerEntry[config.audioserver.macID].master; // Set the audio server MAC
        config.audioserver.name = audioServerEntry[config.audioserver.macID].name; // Set the audio server name
        config.audioserver.uuid = audioServerEntry[config.audioserver.macID].uuid; // Set the audio server UUID
        logger.info(`[config][processAudioServerConfig] Paired AudioServer found [${config.audioserver.name}]`);
        logger.info(`[config][processAudioServerConfig] Requesting Zone initialization from Zone Manager`);
        setupZones();
      }
    }

    return config.audioserver; // Return the updated AudioServer config
  } catch (error) {
    logger.error('Error processing AudioServer config:', error instanceof Error ? error.message : 'Unknown error');
    return null; // Return null if there's an error
  }
};

/**
 * Informs the MiniServer that the AudioServer is starting up.
 * This function sends a request to the MiniServer to indicate that the
 * AudioServer is ready for communication.
 *
 * @param {string} authorization - The Basic Auth token for authentication with the MiniServer.
 * @returns {Promise<void>} A promise that resolves when the request is completed.
 */
const informMiniServer = async (authorization: string) => {
  try {
    await axios({
      url: `http://${config.miniserver.ip}/dev/sps/devicestartup/${config.audioserver?.uuid}`,
      method: 'get',
      headers: { Authorization: authorization },
    });
    logger.info('[config][informMiniServer] AudioServer is ready and has informed the MiniServer.');
  } catch (error) {
    logger.error('Error informing the MiniServer:', error instanceof Error ? error.message : 'Unknown error');
  }
};

/**
 * Initializes the configuration for the application by fetching
 * the AudioServer configuration and informing the MiniServer.
 * This function will exit the process if the AudioServer is not paired.
 *
 * @returns {Promise<void>} A promise that resolves when the configuration is initialized.
 */
const initializeConfig = async () => {
  try {
    const audioServerConfigData = await downloadAudioServerConfig(); // Download the AudioServer config
    const audioServerConfig = await processAudioServerConfig(audioServerConfigData); // Process the downloaded config
    config.audioserver = audioServerConfig || DEFAULT_AUDIO_SERVER; // Update the audioserver configuration or use defaults

    if (!config.audioserver.paired) {
      logger.error('[initializeConfig] AudioServer is not paired.'); // Log the error message
      return
    }

    // Create Basic Auth token for MiniServer communication
    const encodedBase64Token = Buffer.from(`${config.miniserver.username}:${config.miniserver.password}`).toString(
      'base64'
    );
    const authorization = `Basic ${encodedBase64Token}`;

    // Inform the MiniServer that the AudioServer is starting up
    await informMiniServer(authorization);
  } catch (error) {
    logger.error('[initializeConfig] Failed to initialize configuration:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1); // Exit the process if initialization fails
  }
};

// Export the config and initialize function for use in other modules
export { config, initializeConfig, processAudioServerConfig };
