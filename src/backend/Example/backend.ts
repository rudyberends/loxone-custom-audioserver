import Backend from '../backendBaseClass'; // Import the base class
import logger from '../../utils/troxorlogger'; // Import the custom logger
import { updateZoneTrack, Track } from '../zonemanager'; // Import track-related methods

/**
 * BackendExample class extends the Base backend class to demonstrate
 * how to implement a custom backend for other integrations.
 */
export default class BackendExample extends Backend {
  private updateInterval: NodeJS.Timeout | null = null; // Holds the interval ID

  /**
   * Constructor for the BackendExample class.
   *
   * @param {string} ip - The IP address of the device.
   * @param {string} playerid - The ID of the player.
   */
  constructor(ip: string, playerid: string) {
    super(ip, playerid);
  }

  /**
   * Initializes the connection to the device.
   * This is a demonstration of how an initialization method can be structured.
   *
   * @returns {Promise<void>} - A promise that resolves when the connection is initialized.
   */
  async initialize(): Promise<void> {
    try {
      // Log connection initialization
      logger.info(`[BackendExample] Initializing connection to device at ${this.ip}, Player ID: ${this.playerid}`);

      // Call the common method from the base class for logging
      this.logConnection();

      // Start updating the zone track every 10 seconds
      this.startUpdatingTrack();

    } catch (error) {
      logger.error(`[BackendExample] Error initializing Backend: ${error}`);
      throw error; // Re-throw the error after logging
    }
  }

  /**
   * Starts updating the zone track every 10 seconds.
   */
  private startUpdatingTrack(): void {
    // Set a dummy track for testing purposes
    const dummyTrack: Track = {
      playerid: this.playerid,
      title: `Add .ENV entry for ZONE_${this.playerid}`,
      artist: 'Unknown Artist',
      album: 'Test Album',
      coverurl: 'https://dummycover.url/cover.jpg',
      audiotype: 2,
      audiopath: '/dummy/path',
      mode: 'pause',
      plrepeat: 0,
      plshuffle: 0,
      duration: 300, // 5 minutes duration
      time: 0, // Start from the beginning
      power: 'on',
      volume: 10,
      station: '',
      players: []
    };

    // Update the zone track initially
    updateZoneTrack(this.playerid, dummyTrack);
    logger.info(`[BackendExample] Dummy track set for player ${this.playerid}`);

    // Update the zone track every 10 seconds
    this.updateInterval = setInterval(() => {
      updateZoneTrack(this.playerid, dummyTrack); // Update with the same dummy track or new data
    }, 10000); // 10 seconds
  }

  /**
   * Sends a command to the device.
   * This is an example of how to implement a command-sending method.
   *
   * @param {string} command - The command to be sent to the device.
   * @returns {Promise<void>} - A promise that resolves when the command has been sent.
   */
  async sendCommand(command: string): Promise<void> {
    try {
      logger.info(`[BackendExample][zone ${this.playerid}] Sending command: [${command}] to device at ${this.ip}`);

      // Placeholder for actual logic to send the command to the device
      // e.g., Send HTTP request or WebSocket command to the device API
    } catch (error) {
      logger.error(`[BackendExample] Error sending command [${command}] to device for player ${this.playerid}: ${error}`);
      throw error; // Re-throw for error handling
    }
  }

  /**
   * Cleans up resources when the backend is no longer needed.
   */
  cleanup(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval); // Clear the update interval
      logger.info(`[BackendExample] Cleared track update interval for player ${this.playerid}`);
    }
  }
}
