import { handleSecureHello, handleSecureAuthenticate, handleSecureInit, handleSecureInfoPairing } from './secureCommands';
import { audioCfgReady, audioCfgGetKey, audioGetStatus, audioCfgGetConfig, audioCfgGetRoomFavs, audioCfgGetMediaFolder, audioCfgGetRadios } from './audioCommands';
import logger from '../../utils/troxorlogger';
import { sendCommandToZone } from '../../backend/zonemanager';

export const COMMANDS = {
  SECURE_INFO_PAIRING: 'secure/info/pairing',
  SECURE_HELLO: 'secure/hello',
  SECURE_AUTHENTICATE: 'secure/authenticate',
  SECURE_INIT: 'secure/init',
  MINISERVER_TIME: 'audio/cfg/miniservertime',
  AUDIO_CFG_READY: 'audio/cfg/ready',
  AUDIO_CFG_GET_CONFIG: 'audio/cfg/getconfig',
  AUDIO_CFG_SET_CONFIG: 'audio/cfg/setconfig',
  AUDIO_CFG_GET_KEY: 'audio/cfg/getkey',
  AUDIO_CFG_GET_MEDIA_FOLDER: 'audio/cfg/getmediafolder',
  AUDIO_CFG_GET_PLAYLISTS: 'audio/cfg/getplaylists2/lms',
  AUDIO_CFG_GET_RADIOS: 'audio/cfg/getradios',
  AUDIO_CFG_GET_ROOM_FAVS: 'audio/cfg/getroomfavs',
  AUDIO_CFG_GET_SYNCED_PLAYERS: 'audio/cfg/getsyncedplayers',
  AUDIO_CFG_GET_QUEUE: 'audio/\\d+/getqueue',
  AUDIO_PLAYER_STATUS: 'audio/\\d+/status',
  AUDIO_GROUP: 'audio/cfg/dgroup',
  AUDIO_COMMANDS_PATTERN: 'audio/\\d+/(on|off|play|resume|pause|queueminus|queueplus|volume|repeat|shuffle|test)',
};

const commandHandlers = {
  [COMMANDS.SECURE_INFO_PAIRING]: handleSecureInfoPairing,
  [COMMANDS.SECURE_HELLO]: handleSecureHello,
  [COMMANDS.SECURE_AUTHENTICATE]: handleSecureAuthenticate,
  [COMMANDS.SECURE_INIT]: handleSecureInit,
  [COMMANDS.AUDIO_CFG_GET_CONFIG]: audioCfgGetConfig,
  [COMMANDS.AUDIO_CFG_READY]: audioCfgReady,
  [COMMANDS.AUDIO_CFG_GET_KEY]: audioCfgGetKey,
  [COMMANDS.AUDIO_CFG_GET_MEDIA_FOLDER]: audioCfgGetMediaFolder,
  [COMMANDS.AUDIO_CFG_GET_ROOM_FAVS]: audioCfgGetRoomFavs,
  [COMMANDS.AUDIO_CFG_GET_RADIOS]: audioCfgGetRadios,
};

export const handleLoxoneCommand = (trimmedUrl: string): any => {
  if (!trimmedUrl) {
    return unknownCommand(''); // Handle undefined case
  }

  // Directly check if the URL matches a command
  for (const [command, handler] of Object.entries(commandHandlers)) {
    if (trimmedUrl.startsWith(command)) {
      return handler(trimmedUrl);
    }
  }

  // Handle audio player status
  if (new RegExp(`(?:^|/)${COMMANDS.AUDIO_PLAYER_STATUS}(?:/|$)`).test(trimmedUrl)) {
    return audioGetStatus(trimmedUrl);
  }

  // Handle dynamic audio commands
  if (new RegExp(`(?:^|/)${COMMANDS.AUDIO_COMMANDS_PATTERN}(?:/|$)`).test(trimmedUrl)) {
    const [, playerID, command, param] = trimmedUrl.split('/');
    sendCommandToZone(playerID, command, param);
    return emptyCommand(trimmedUrl, []); // Don't bother with changes. Will be pushed by EventBroadcast.
  }

  return unknownCommand(trimmedUrl); // Unknown command handler
};

// Function to handle unknown commands
export function unknownCommand(url: string) {
  logger.info(`[RequestHandler] Loxone Request not processed: ${url}`);
  return emptyCommand(url, []);
}

// Function to format an empty command response
export function emptyCommand(url: string, rsp: any) {
  const parts = url.split('/');
  for (let i = parts.length; i--;) {
    if (/^[a-z]/.test(parts[i])) {
      return response(url, parts[i], rsp);
    }
  }
}

// Function to format a response message
export function response(url: string, name: string, result: any) {
  // Trim any unwanted characters (e.g., newline) from the URL or command name
  const sanitizedUrl = url.trim();
  const sanitizedName = name.trim();
  
  const message = {
    [`${sanitizedName}_result`]: result,
    command: sanitizedUrl,
  };
  return JSON.stringify(message, null, 2);
}

