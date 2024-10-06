import logger from '../utils/troxorlogger';

/**
 * Abstract base class representing a backend connection.
 * Subclasses must implement the initialize method.
 */
export default abstract class Backend {
  protected ip: string; // The IP address of the backend device
  protected playerid: string; // The identifier for the player

  /**
   * Constructor for the Backend class.
   *
   * @param {string} ip - The IP address of the device.
   * @param {string} playerid - The ID of the player.
   */
  constructor(ip: string, playerid: string) {
    this.ip = ip; // Set the IP address
    this.playerid = playerid; // Set the player ID
  }

  /**
   * Abstract method to initialize the backend connection.
   *
   * Subclasses must implement this method to establish their own backend connection.
   *
   * @returns {Promise<void>} - A promise that resolves when the initialization is complete.
   */
  abstract initialize(): Promise<void>;

  /**
   * Abstract method to send commands to the backend connection.
   *
   * Subclasses must implement this method to establish their own backend connection.
   *
   * @returns {Promise<void>} - A promise that resolves when the initialization is complete.
   */
  abstract sendCommand(command: string, param: any): Promise<void>;

  /**
   * Logs a connection message to the logger.
   *
   * This method can be used by subclasses to log when they have successfully connected to the backend.
   */
  logConnection(): void {
    logger.info(`[Backend] Connected to backend at ${this.playerid}`);
  }

  sendGroupCommand(command: any, type: any, playerid: any, ...additionalIDs: any[]): void {
    logger.error(`[Backend] Not Implemented`);
  }
}
