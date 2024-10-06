import Backend from '../backendBaseClass'; // Base backend class
import logger from '../../utils/troxorlogger'; // Custom logger
import { config } from '../../config/config';
import axios, { AxiosRequestConfig } from 'axios'; // Import Axios
import ndjson from 'ndjson'; // Used for parsing the NDJSON stream
import { Readable } from 'stream'; // To handle stream types
import { getZoneById, updateZoneTrack, Track, sendCommandToZone, updateZoneGroup } from '../zonemanager';

// Define the NotificationData interface to structure the notification data
interface NotificationData {
  friendlyName?: string;
  playQueueItemId?: string;
  speaker?: {
    level: number; // Volume level of the speaker
  };
  artist?: string; // Artist of the currently playing track
  album?: string; // Album of the currently playing track
  name?: string; // Name of the currently playing track
  duration?: number; // Duration of the currently playing track
  trackImage?: { url: string }[]; // Array of track images, where each image has a URL
  state?: string; // Current state of the playback (e.g., playing, paused)
  position?: number; // Current playback position in seconds
}

// Define the NotificationMessage interface to structure the notification message
interface NotificationMessage {
  notification: {
    type: string; // Type of the notification (e.g., SOURCE, VOLUME)
    data: NotificationData; // Data associated with the notification
  };
}

/**
 * BackendBeolink class extends the Base backend class to handle Beolink notifications.
 */
export default class BackendBeolink extends Backend {
  private notifyUrl: string; // URL for the BeoNotify notifications
  private notifyStream: Readable | null; // Stream for notifications

  /**
   * Constructor for the BackendBeolink class.
   *
   * @param {string} ip - The IP address of the device.
   * @param {string} playerid - The ID of the player.
   */
  constructor(ip: string, playerid: string) {
    super(ip, playerid);
    this.notifyUrl = `http://${this.ip}:8080/BeoNotify/Notifications`; // Notification URL based on IP
    this.notifyStream = null; // Initialize notifyStream as null
  }

  /**
   * Initializes the notification listener and sets an interval to reset it every 3 minutes.
   *
   * @returns {Promise<void>} - A promise that resolves when the initialization is complete.
   */
  async initialize(): Promise<void> {
    try {
      await this.createNotificationListener();

      // Reset notification listener every 3 minutes
      setInterval(async () => {
        await this.closeNotificationListener();
        await this.createNotificationListener();
      }, 180000); // 3 minutes in milliseconds
    } catch (error) {
      logger.error(`[BeolinkBackend] Error initializing Beolink: ${error}`);
      throw error;
    }
  }

  /**
   * Closes the current notification listener stream if it exists.
   *
   * @returns {Promise<void>} - A promise that resolves when the listener is closed.
   */
  private async closeNotificationListener(): Promise<void> {
    if (this.notifyStream) {
      try {
        this.notifyStream.destroy(); // Destroy the stream
        logger.info(`[BeoNotify][Zone:${this.playerid}] Notification listener reset for IP ${this.ip}`);
      } catch (error) {
        logger.error(`[BeoNotify] Error resetting notification listener for IP ${this.ip}`);
      } finally {
        this.notifyStream = null; // Set notifyStream to null
      }
    }
  }

  /**
   * Creates a notification listener for receiving Beolink notifications.
   *
   * @returns {Promise<void>} - A promise that resolves when the listener is created.
   */
  private async createNotificationListener(): Promise<void> {
    try {
      const response = await axios.get(this.notifyUrl, {
        responseType: 'stream', // Set response type to stream
      });

      this.notifyStream = response.data.pipe(ndjson.parse()); // Parse NDJSON stream

      logger.info(`[BeoNotify][Zone:${this.playerid}] Notification listener active for IP ${this.ip}`);

      // Listen for data events from the notification stream
      this.notifyStream!.on('data', async (msg: NotificationMessage) => {
        await this.handleNotification(msg);
      });

      // Handle errors from the notification stream
      this.notifyStream!.on('error', (error: any) => {
        logger.error(`[BeoNotify] Error during notification stream for IP ${this.ip}: ${error}`);
      });
    } catch (error) {
      logger.error(`[BeoNotify] Error initializing notification stream for IP ${this.ip}: ${error}`);
    }
  }

  /**
   * Creates a track information object based on the notification type and data.
   *
   * @param {string} type - The type of the notification.
   * @param {NotificationData} data - The data associated with the notification.
   * @returns {Partial<Track>} - A partial Track object containing the updated track information.
   */
  private createTrackInfo(type: string, data: NotificationData): Partial<Track> {
    switch (type) {
      case 'SOURCE':
        return {
          power: 'on',
          title: data.friendlyName || 'Unknown Source',
        };

      case 'VOLUME':
        return { volume: data.speaker?.level }; // Use optional chaining

      case 'NOW_PLAYING_STORED_MUSIC':
        return {
          audiotype: 2,
          artist: data.artist,
          album: data.album,
          title: data.name,
          duration: data.duration,
          // Take the original url and serve it using the cors-proxy. This prevents cors Issues.
          // Also, airplay image names dont change, so Loxone clients think its the same image and never reload the image.
          // We are using a unique querystring (cacheBusting), to make sure the image is updated every time the track changes.
          coverurl: `http://${config.audioserver?.ip}:7091/cors-proxy?url=${encodeURIComponent(data.trackImage?.[0]?.url || '')}&id=${encodeURIComponent(data.album || 'x')}`,
        };

      case 'PROGRESS_INFORMATION': {
        const trackInfo: Partial<Track> = {
          mode: data.state,
          time: data.position,
        };

        if (data.playQueueItemId && data.playQueueItemId === 'AUX') {
          trackInfo.audiotype = 1;
          trackInfo.duration = 0;
        }
        return trackInfo;
      }

      case 'SHUTDOWN':
      case 'NOW_PLAYING_ENDED':
        return {
          audiotype: 0,
          artist: '',
          album: '',
          title: '',
          duration: 0,
          coverurl: '',
        };

      default:
        return {}; // Return an empty object for unhandled types
    }
  }

  /**
   * Sends a group command to join additional player IDs in a Beolink group.
   *
   * @param {string} command - The command to execute for the group action.
   * @param {string} type - The type of the command, e.g., 'Audio'.
   * @param {string} playerid - The ID of the master player (the group creator).
   * @param {...string[]} additionalIDs - The IDs of the additional players to be added to the group.
   * 
   * This method logs the creation of a new Beolink group and attempts to add each
   * additional player ID to the group, skipping the master ID.
   * 
   */
  sendGroupCommand(command: string, type: string, playerid: string, ...additionalIDs: string[]): void {
    // Custom implementation for sending a group command
    logger.info(`[BeoLink] Creating New Beolink Group. Master: ${this.playerid} | GroupMembers: ${additionalIDs.join(', ')}`);

    // Loop over additional IDs and perform an action for each, ignoring the master ID
    additionalIDs.forEach((id) => {
      if (id !== this.playerid) { // Check if the ID is not the master ID
        logger.info(`[BeoLink] Adding member to group: ${id}`);
        sendCommandToZone(id, 'groupJoin', this.playerid); // Send command to join the group
      } else {
        logger.info(`[BeoLink] Skipping master ID: ${id}`); // Log that the master ID is being skipped
      }
    });
    updateZoneGroup();
  }


  /**
   * Handles incoming notifications and updates the zone track information accordingly.
   *
   * @param {NotificationMessage} msg - The notification message received from the Beolink API.
   * @returns {Promise<void>} - A promise that resolves when the notification is handled.
   */
  private async handleNotification(msg: NotificationMessage): Promise<void> {
    logger.debug(`[BeoNotify][Zone:${this.playerid}] Received notification: ${msg.notification.type}`);

    // Create trackInfo based on the notification type
    const trackInfo = this.createTrackInfo(msg.notification.type, msg.notification.data);

    // Log the trackInfo for debugging purposes
    if (trackInfo.audiotype !== undefined) {
      logger.debug(`[BeoNotify][Zone:${this.playerid}] Track information: ${JSON.stringify(trackInfo)}`);
    }

    // Update the zone track information using ZoneManager
    updateZoneTrack(this.playerid, trackInfo);
  }

  /**
   * Sends a command to the Beolink Device based on the provided command string.
   *
   * @param {string} command - The command to send (e.g., "play", "pause").
   * @returns {Promise<void>} - A promise that resolves when the command has been sent.
   */
  async sendCommand(command: string, param: any): Promise<void> {
    logger.info(`[BeoLink][zone ${this.playerid}][${command}] Sending command`);

    // Map commands to actions
    const actionMap: Record<string, string> = {
      resume: 'Stream/Play',
      play: 'Stream/Play',
      pause: 'Stream/Pause',
      queueminus: 'Stream/Backward',
      queueplus: 'Stream/Forward',
      volume: 'adjustVolume',
      groupJoin: 'Device/OneWayJoin',
      groupLeave: 'Device/OneWayJoin',
      repeat: 'List/Repeat',
      shuffle: 'List/Shuffle'
    };

    const action = actionMap[command];

    if (action) {
      if (action === 'adjustVolume') {
        await this.adjustVolume(param);
      } else {
        await this.doAction(action);
      }
    } else {
      logger.warn(`[BeoLink][zone ${this.playerid}] Unknown command: ${command}`);
    }
  }

  /**
   * Adjusts the current volume by a specified amount (+3 or -3).
   *
   * @param {number} change - The amount to change the volume by (+3 or -3).
   * @returns {Promise<void>} - A promise that resolves when the volume adjustment is complete.
   */
  private async adjustVolume(change: number): Promise<void> {
    try {
      const zone = getZoneById(this.playerid);

      // Ensure currentVolume is a number
      const currentVolume = Number(zone.track.volume); // Convert to number
      const volumeChange = Number(change); // Ensure change is also a number

      // Calculate the new volume
      const newVolume = currentVolume + volumeChange; // Numeric addition

      // Update the zone with the new volume
      const updatedTrackInfo: Partial<Track> = {
        volume: newVolume, // This should now be a number
      };
      updateZoneTrack(this.playerid, updatedTrackInfo);

      logger.debug(`[BeoLink][Zone ${this.playerid}] Volume changed by ${volumeChange}, new volume: ${newVolume}`);

      // Set the volume on the backend using an HTTP PUT request
      const url = `http://${this.ip}:8080/BeoZone/Zone/Sound/Volume/Speaker/Level`;

      try {
        // Send the new volume to the backend
        const response = await axios.put(url, { level: newVolume });
        logger.info(`[BeoRemote][Zone ${this.playerid}] Volume set to ${newVolume} on the backend`);
        return response.data; // Return the response data if needed
      } catch (error) {
        logger.error(`[BeoRemote][Zone ${this.playerid}] Error setting volume on the backend: ${error}`);
      }
    } catch (error) {
      logger.error(`[BeoLink][Zone ${this.playerid}] Error adjusting volume: ${error}`);
    }
  }

  /**
   * Sends a specific action to the Beolink backend via HTTP.
   *
   * @param {string} action - The action to send to the Beolink backend.
   * @returns {Promise<void>} - A promise that resolves when the action is sent.
   */
  private async doAction(action: string): Promise<void> {
    const url = `http://${this.ip}:8080/BeoZone/Zone/${action}`;

    // Define the request options
    const options: AxiosRequestConfig = {
      method: 'POST',
      responseType: 'text', // or 'json' depending on your expected response
    };

    try {
      // Send the request with Axios
      const response = await axios.post(url, {}, options);
      logger.info(`[BeoRemote][zoneId ${this.playerid}] Response: ${response.data}`);
    } catch (error) {
      const errorMsg = axios.isAxiosError(error) ? error.response?.data : error;
      logger.error(`[BeoRemote][zoneId ${this.playerid}] Error on HTTP request: ${errorMsg}`);
    }
  }
}
