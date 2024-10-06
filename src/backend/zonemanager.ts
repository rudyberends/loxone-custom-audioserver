import logger from '../utils/troxorlogger'; // Importing the custom logger for logging messages
import { config } from '../config/config'; // Import config from the configuration module
import { broadcastEvent } from '../http/broadcastEvent';
import { createBackend } from './backendFactory';

// Define the structure for Player
interface Player {
  uuid: string; // Unique identifier for the player
  playerid: string; // ID of the player
  backend: string; // Backend service associated with the player
  ip: string; // IP address of the player
}

// Define the structure for Track
interface Track {
  playerid: string; // ID of the player associated with the track
  coverurl: string; // URL for the track cover image
  station: string; // Station name for radio tracks
  audiotype: number; // Type of audio
  audiopath: string; // Path to the audio file
  mode: string; // Playback mode (e.g., stop, play, pause)
  plrepeat: number; // Repeat mode for playback
  plshuffle: number; // Shuffle mode for playback
  duration: number; // Duration of the track in seconds
  time: number; // Current playback time
  power: string; // Power state of the player (e.g., on, off)
  volume: number; // Volume level of the player
  title?: string;
  album?: string;
  artist?: string;
  players: { playerid: string }[]; // Array of players associated with the track
}

// Define the structure for Zone
interface Zone {
  [playerId: string]: {
    player: {
      uuid: string; // Unique identifier for the player
      playerid: string; // ID of the player
      clienttype: number; // Type of client (e.g., 0 for default)
      enabled: boolean; // Indicates if the player is enabled
      internalname: string; // Internal name for the zone
      max_volume: number; // Maximum volume level for the zone
      name: string; // Name of the zone
      upnpmode: number; // UPnP mode setting
      upnprelay: number; // UPnP relay setting
      backend: string; // Backend service associated with the zone
      ip: string; // IP address of the zone
      backendInstance?: any; // Store the backend instance here
    };
    track: Track; // Track information associated with the zone
  };
}

// Initialize an in-memory database for zones
const zone: Zone = {};

/**
 * Sets up zones based on the music configuration fetched from the MiniServer.
 * This function initializes each player as a zone and logs relevant information.
 *
 * @returns {Promise<void>} A promise that resolves when zones are set up.
 * @throws {Error} Throws an error if no music configuration or players are found.
 */
const setupZones = async (): Promise<void> => {
  // Check if music configuration is available
  if (!config.audioserver?.musicCFG || config.audioserver.musicCFG.length === 0) {
    logger.error('[ZoneManager] No Music configuration found. Skipping Zone Initialization');
    return
  }

  const musicConfig = config.audioserver.musicCFG[0]; // Access the first music configuration
  const players = (musicConfig[config.audioserver.macID]?.players as Player[]) || []; // Get players from the configuration

  // Check if any players are configured
  if (players.length === 0) {
    logger.error('[ZoneManager] No players configured in Music configuration. Skipping Zone Initialization');
    return
  }

  logger.info(`[ZoneManager] ${players.length} zones configured in Music configuration.`); // Log number of zones

  // Initialize each player as a zone
  for (const player of players) {
    const playerId = player.playerid.toString(); // Convert player ID to string
    let backend = process.env[`ZONE_${playerId}_BACKEND`]; // Get backend from environment variables
    let ip = process.env[`ZONE_${playerId}_IP`]; // Get IP from environment variables

    // Log warnings for missing backend or IP
    if (!backend || !ip) {
      logger.warn(`[ZoneManager] Missing backend or IP for player ID: ${playerId}. Falling back to Dummy Backend.`);
      backend = 'BackendExample';
      ip = '127.0.0.1';
    }

    // Set up the zone with player and track information
    zone[playerId] = {
      player: {
        uuid: player.uuid,
        playerid: player.playerid,
        clienttype: 0,
        enabled: true,
        internalname: `zone-${playerId}`,
        max_volume: 100,
        name: `zone-${playerId}`,
        upnpmode: 0,
        upnprelay: 0,
        backend: backend || '', // Use default if not specified
        ip: ip || '', // Use default if not specified
        backendInstance: backend ? createBackend(backend, ip!, playerId) : null, // Store backend instance
      },
      track: {
        playerid: playerId,
        coverurl: '',
        station: '',
        audiotype: 2,
        audiopath: '',
        mode: 'stop',
        plrepeat: 0,
        plshuffle: 0,
        duration: 0,
        time: 0,
        power: 'on',
        volume: 0,
        players: [{ playerid: playerId }],
      },
    };

    logger.info(
      `[ZoneManager] Zone set up for player ID: ${playerId}, Backend: ${backend || 'not specified'}, IP: ${ip || 'not specified'}`,
    ); // Log successful zone setup

    if (zone[playerId].player.backendInstance) {
      try {
        await zone[playerId].player.backendInstance.initialize();
      } catch (error) {
        logger.error(`[ZoneManager] Error initializing zone backend for player ID: ${playerId}: ${error}`);
      }
    }
  }
};

/**
 * Sends a command to the specified zone's backend.
 * This function allows sending a command to the backend service associated with a zone based on the provided player ID and command.
 *
 * @param {string} playerId - The ID of the player whose backend will receive the command.
 * @param {string} command - The command to be sent to the backend.
 * @param {string} param - The parameter to be sent to the backend.
 * @returns {Promise<void>} A promise that resolves when the command has been sent.
 * @throws {Error} Throws an error if the backend is not defined for the player ID.
 */
const sendCommandToZone = async (playerId: string, command: string, param: string): Promise<void> => {
  const zone = getZoneById(playerId); // Get the zone by player ID
  const backendInstance = zone.player.backendInstance; // Get the backend instance

  if (backendInstance) {
    try {
      await backendInstance.sendCommand(command, param);
    } catch (error) {
      logger.error(`[ZoneManager] Error sending command to zone backend for player ID: ${playerId}: ${error}`);
    }
  } else {
    logger.error(`[ZoneManager] No backend instance found for player ID: ${playerId}`);
  }
};

/**
 * Sends a group command to the backend for a specified zone based on the provided group IDs.
 *
 * @param {string} command - The command to execute for the group action.
 * @param {any} type - The type of the command, which can be specific to the command's context.
 * @param {string} Group - A comma-separated string of player IDs, where the first ID is the master ID.
 *
 * This function splits the Group string into an array, retrieves the zone associated with the 
 * master ID, and attempts to send the group command to the backend instance. If successful, 
 * it will log any errors encountered during the process.
 *
 */
const sendGroupCommandToZone = async (command: string, type: any, Group: string): Promise<void> => {
  const idArray = Group.split(',');  // Split the IDs by comma
  const masterID = idArray[0];        // The first entry is always the masterID
  const additionalIDs = idArray.slice(1); // Get all additional IDs as an array

  const zone = getZoneById(masterID); // Get the zone by player ID

  const backendInstance = zone ? zone.player.backendInstance : null; // Get the backend instance

  if (backendInstance) {
    try {
      await backendInstance.sendGroupCommand(command, type, masterID, ...additionalIDs);
    } catch (error) {
      logger.error(`[ZoneManager] Error sending command to zone backend for player ID: ${masterID}: ${error}`);
    }
  } else {
    logger.error(`[ZoneManager] No backend instance found for player ID: ${masterID}`);
  }
};

/**
 * Retrieves a zone by player ID.
 * This function searches for a zone in the in-memory database using the provided player ID.
 *
 * @param {string} playerId - The ID of the player whose zone is to be retrieved.
 * @returns {any} The zone associated with the player ID.
 * @throws {Error} Throws an error if no zone is found for the player ID.
 */
const getZoneById = (playerId: string): any => {
  const foundZone = zone[playerId]; // Find the zone by player ID

  // Check if AudioServer is Paired
  if (!config.audioserver?.paired) {
    logger.error(`[ZoneManager] !! AudioServer not Paired. NO Zones initialized !!`);
  }

  // Check if the zone exists
  if (!foundZone) {
    logger.error(`[ZoneManager] No zone found for player ID: ${playerId}`); // Log error if not found
    return [];
  }

  return foundZone; // Return the found zone
};

/**
 * Updates the track information for a specific zone.
 * This function allows updating track details for a zone based on the provided player ID and new track information.
 *
 * @param {string} playerId - The ID of the player whose track information is to be updated.
 * @param {Partial<Track>} newTrackInfo - The new track information to update.
 * @returns {boolean} Returns true if the update was successful, otherwise false.
 */
const updateZoneTrack = (playerId: string, newTrackInfo: Partial<Track>): boolean => {
  const existingZone = zone[playerId]; // Find the existing zone

  // Check if the zone exists
  if (!existingZone) {
    logger.error(`[ZoneManager] Cannot update track: No zone found for player ID: ${playerId}`); // Log error if not found
    return false; // Return false to indicate failure
  }

  // Update the track information with new data
  existingZone.track = { ...existingZone.track, ...newTrackInfo };
  logger.debug(`[ZoneManager] Updated track for player ID: ${playerId}`, existingZone.track); // Log successful update

  // Push the new information to all WebSocket Clients
  const audioEventMessage = JSON.stringify({
    audio_event: [existingZone.track],
  });

  broadcastEvent(audioEventMessage); // Broadcast updated track information to WebSocket clients

  return true; // Return true to indicate success
};

// TODO
// Test with BeoLink
const updateZoneGroup = () => {
  broadcastEvent(`{"audio_sync_event":[{"group":"fe78dcce-e931-095d-0eff-018e010d95d8","mastervolume":25,"players":[{"id":"${zone[15].player.uuid}","playerid":${zone[15].player.playerid}},{"id":"${zone[14].player.uuid}","playerid":${zone[14].player.playerid}}],"type":"dynamic"}]}`)
}
// TODO

export { setupZones, sendCommandToZone, sendGroupCommandToZone, updateZoneTrack, updateZoneGroup, getZoneById, Track };
