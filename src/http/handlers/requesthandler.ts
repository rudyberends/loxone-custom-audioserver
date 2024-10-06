// TODO: CLeanup and split code

import { config, processAudioServerConfig } from '../../config/config';
import logger from '../../utils/troxorlogger';
import NodeRSA from 'node-rsa';
import { getZoneById, sendCommandToZone, sendGroupCommandToZone } from '../../backend/zonemanager';
import { stringify } from 'querystring';
import { asyncCrc32 } from '../../utils/crc32utils';

const rsaKey = new NodeRSA({ b: 2048 });
rsaKey.setOptions({ encryptionScheme: 'pkcs1' });

// Constants for command strings
const COMMAND_SECURE_INFO_PAIRING = 'secure/info/pairing';
const COMMAND_SECURE_HELLO = 'secure/hello';
const COMMAND_SECURE_AUTHENTICATE = 'secure/authenticate';
const COMMAND_SECURE_INIT = 'secure/init';
const COMMAND_MINISERVER_TIME = 'audio/cfg/miniservertime';
const COMMAND_AUDIO_CFG_READY = 'audio/cfg/ready';
const COMMAND_AUDIO_CFG_GETCONFIG = 'audio/cfg/getconfig';
const COMMAND_AUDIO_CFG_SETCONFIG = 'audio/cfg/setconfig';
const COMMAND_AUDIO_CFG_GET_KEY = 'audio/cfg/getkey';
const COMMAND_AUDIO_CFG_GET_MEDIA_FOLDER = 'audio/cfg/getmediafolder';
const COMMAND_AUDIO_CFG_GET_PLAYLISTS = 'audio/cfg/getplaylists2/lms';
const COMMAND_AUDIO_CFG_GET_RADIOS = 'audio/cfg/getradios';
const COMMAND_AUDIO_CFG_GET_ROOM_FAVS = 'audio/cfg/getroomfavs';
const COMMAND_AUDIO_CFG_GET_SYNCED_PLAYERS = 'audio/cfg/getsyncedplayers';
const COMMAND_AUDIO_CFG_GET_QUEUE = 'audio/\\d+/getqueue';
const COMMAND_AUDIO_PLAYER_STATUS = 'audio/\\d+/status';
const AUDIO_GROUP = 'audio/cfg/dgroup';
const AUDIO_COMMANDS_PATTERN = 'audio/\\d+/(on|off|play|resume|pause|queueminus|queueplus|volume|repeat|shuffle|test)';

function audioCfgReady(url: string) {
  return emptyCommand(url, { session: 547541322864 });
}

function audioCfgGetKey(url: string) {
  // Export the public key components
  const publicKeyComponents = rsaKey.exportKey('components-public');

  // Get the modulus (n) and exponent (e)
  const data = [
    {
      pubkey: publicKeyComponents.n.toString('hex'), // Correctly convert Buffer to hex string
      exp: publicKeyComponents.e, // Public exponent (number)
    },
  ];

  return emptyCommand(url, data);
}

function audioGetStatus(url: string) {
  const [, zoneId] = url.split('/');

  return response(url, 'status', [getZoneById(zoneId).track]);
}

function audioGetQueue(url: string) {
  //const [, zoneId, , start, length] = url.split('/');
  //const zone = this._zones[zoneId];

  //return response(url, 'getqueue', []);
  return response(url, 'getqueue', [
    {
      id: 1,
      items: [
        {
          album: '',
          artist: '',
          audiopath: 'linein:504F94F042A3#1000001',
          audiotype: 3,
          coverurl:
            'http://10.7.10.151:7091/imgcache/?item=linein&icontype=8&enabled=1&viaproxy=170ab4fc-0261-9bac-ffffc581ef707fce',
          duration: 0,
          icontype: 8,
          qindex: 0,
          station: '',
          title: 'SatRadio',
          unique_id: 'linein:504F94F042A3#1000001',
          user: '',
        },
      ],
      shuffle: false,
      start: 0,
      totalitems: 1,
    },
  ]);
}

function audioCfgGetRoomFavs(url: string) {
  const [, , , zoneId] = url.split('/');

  return response(url, 'getroomfavs', [
    {
      id: parseInt(zoneId),
      totalitems: 3,
      start: 0,
      items: [
        {
          type: 'tunein',
          slot: 1,
          audiopath: 's6717',
          coverurl:
            // eslint-disable-next-line max-len
            'http://192.168.1.222:7092/http://192.168.1.222:9000/imageproxy/http://cdn-profiles.tunein.com/s6717/images/logoq.jpg/image.jpg',
          id: 's6717',
          name: 'Veronica',
          title: 'Radio Veronica 91.6 (Classic Hits)',
          artist: '',
          album: '',
          station: '',
          contentType: 'ZoneFavorites',
          mediaType: 'favorites',
        },
        {
          type: 'local',
          slot: 2,
          audiopath: 'WyJ1cmw6ZmlsZSUzQSUyRiUyRiUyRnRtcCUyRkJlb3NvdW5kJTI1MjBHcm9lbi5tM3UiLDEwMDAwMDJd',
          id: 'WyJ1cmw6ZmlsZSUzQSUyRiUyRiUyRnRtcCUyRkJlb3NvdW5kJTI1MjBHcm9lbi5tM3UiLDEwMDAwMDJd',
          coverurl: 'http://192.168.1.35:7091/img/groen.png',
          name: 'Beosound Groen',
          title: 'Apple Music',
          artist: '',
          album: '',
          station: '',
          contentType: 'ZoneFavorites',
          mediaType: 'favorites',
        },
        {
          type: 'local',
          slot: 3,
          audiopath: 'WyJ1cmw6ZmlsZSUzQSUyRiUyRiUyRnRtcCUyRkJlb3NvdW5kJTI1MjBHcm9lbi5tM3UiLDEwMDAwMDJd',
          id: 'WyJ1cmw6ZmlsZSUzQSUyRiUyRiUyRnRtcCUyRkJlb3NvdW5kJTI1MjBHcm9lbi5tM3UiLDEwMDAwMDJd',
          coverurl: 'http://192.168.1.35:7091/img/lucifer.png',
          name: 'Lucifers Playlist',
          title: 'Apple Music',
          artist: '',
          album: '',
          station: '',
          contentType: 'ZoneFavorites',
          mediaType: 'favorites',
        },
      ],
    },
  ]);
}

function audioCfgGetRadios(url: string) {
  return response(url, 'getradios', [
    {
      cmd: 'presets',
      name: 'Radio Favorieten',
      icon: 'http://10.7.10.151:7091/imgcache/?item=radiomusic&viaproxy=170ab4fc-0261-9bac-ffffc581ef707fce',
      root: 'start',
    },
    {
      cmd: 'all',
      name: 'Alles',
      icon: 'http://10.7.10.151:7091/imgcache/?item=radioworld&viaproxy=170ab4fc-0261-9bac-ffffc581ef707fce',
      root: 'start',
    },
  ]);
}

function audioCfgGetMediaFolder(url: string) {
  const [, , , requestId, start] = url.split('/');

  //const {total, items} = await this._master.getLibraryList().get(rootItem, +start, +length);

  return response(url, 'getmediafolder', [
    {
      id: requestId,
      totalitems: 0,
      start: +start,
      items: [],
      //items: items.map(this._convert(2, BASE_LIBRARY, +start)),
    },
  ]);
}

function audioCfgGetPlaylists(url: string) {
  const [, , , , , id, start] = url.split('/');

  //const { total, items } = await this._master.getPlaylistList().get(rootItem, +start, +length);

  return response(url, 'getplaylists2', [
    {
      id: id,
      totalitems: 0,
      start: +start,
      items: [],
      //items: items.map(this._convert(11, BASE_PLAYLIST)),
    },
  ]);
}

function audioCfgGetSyncedPlayers(url: string) {
  return emptyCommand(url, []);
}

// Function to handle unknown commands
function unknownCommand(url: string) {
  logger.info(`[RequestHandler] Loxone Request not processed: ${url}`);
  return emptyCommand(url, null);
}

// Function to construct an empty command response
function emptyCommand(url: string, rsp: any) {
  const parts = url.split('/');

  for (let i = parts.length; i--;) {
    if (/^[a-z]/.test(parts[i])) {
      return response(url, parts[i], rsp);
    }
  }
}

// Function to create a response message
function response(url: string, name: string, result: any) {
  const message = {
    [`${name}_result`]: result,
    command: url,
  };
  return JSON.stringify(message, null, 2);
}

// Handle secure hello commands
function handleSecureHello(trimmedUrl: string) {
  const [, , id, pub_key] = trimmedUrl.split('/');
  return `{"command":"${COMMAND_SECURE_HELLO}","error":0,"public_key":"${pub_key}"}`;
}

function handleSecureAuthenticate(url: string) {
  return emptyCommand(url, 'authentication successful');
}

// Handle secure init commands
function handleSecureInit() {
  // eslint-disable-next-line max-len
  return '{"command":"secure/init","error":0,"jwt":"eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJleHAiOiAxNjQwNjEwMTQ0LAogICJpYXQiOiAxNjQwNjEwMDg0LAogICJzZXNzaW9uX3Rva2VuIjogIjhXYWh3QWZVTHdFUWNlOVl1MHFJRTlMN1FNa1hGSGJpME05Y2g5dktjZ1lBclBQb2pYSHBTaU5jcTBmVDNscUwiLAogICJzdWIiOiAic2VjdXJlLXNlc3Npb24taW5pdC1zdWNjZXNzIgp9.Zd5M55YPirdugqlGr7u6iB-kM_oFqnvMnpxL8gj58vF2L4ocpSY6S8OB_4f8LeIB2AIYikN5U6R0UALJ3Oahxa0gq9qKDoNrjC7-Q8wAe1rEhDbvdWtaRzmgiHnivrz0cNsyeYGBX8c5Ix6pLI8URGjR1Ox2lbxBt_pVZ-MyEvhVNSJ0-DttclqIAgr_24tVmwe6lleT5eKyBoQVAcGJP-3LSdORKckHTCRw6aaf6sOQ7AtK37SXgnHB6J4g2wErvyw29mMAmDTbR8vZUCmTxgnmhbrks02AZITLaDeGAYTlSASWDSl84L9wkWOWk0pufZIGG0zcXgL8EoWD8cw_fIhbh-LXODEY5251u0DlVtaI_6J6o2j8jy_WvsSqKh-sqqy-ygScwPkLgFua7GNlppaHUGsFaEg0rVdLvVAiIV3mbOGnis1RuWcTWY9iuPVxFTODxkOZNRgZttBb_NFa8lQPJKwwhA33YC1hJ6DE3xEC2rvc4LGE400nLKnELNKpFNsom07JFSQQq8NV3Z1lzTksa8ANdXrV080J8x0c1Bt4dcUyx3lzFE8XG3DsLXCnL2YsJ9ik2jdSBZL8grnoQjqvJWaX3j47P0VM-jaMICVb6QcVP-nNB7k5n1qQGASsbkhcB1nffzE_wLooUe4iLxJQ2dkCM1n7ngXDF6HK0_A"}'; // JWT should be handled securely
}

// Common handler for processing requests
export const handleLoxoneCommand = (trimmedUrl: string): any => {
  if (!trimmedUrl) {
    return unknownCommand(''); // Handle undefined case
  }

  const name = 'MsHttpRequest';

  // Log the incoming request URL
  //logger.info(`[${name}] Handling request: ${trimmedUrl}`);

  switch (true) {
    case trimmedUrl === COMMAND_MINISERVER_TIME:
      return `Handled Miniserver time request with URL: ${trimmedUrl}`;

    case trimmedUrl === COMMAND_SECURE_INFO_PAIRING:
      return `{"command":"${COMMAND_SECURE_INFO_PAIRING}","error":-84,"master":"${config.miniserver.mac}","peers":[]}`;

    case trimmedUrl.startsWith(COMMAND_SECURE_HELLO):
      return handleSecureHello(trimmedUrl);

    case trimmedUrl.startsWith(COMMAND_SECURE_AUTHENTICATE):
      return handleSecureAuthenticate(trimmedUrl);

    case trimmedUrl.startsWith(COMMAND_SECURE_INIT):
      return handleSecureInit();

    case trimmedUrl.startsWith(COMMAND_AUDIO_CFG_READY):
      return audioCfgReady(trimmedUrl);

    case trimmedUrl.startsWith(COMMAND_AUDIO_CFG_GETCONFIG):
      return emptyCommand(trimmedUrl, { crc32: config.audioserver?.musicCRC, extensions: [] });

      case trimmedUrl.startsWith(COMMAND_AUDIO_CFG_SETCONFIG):
        try {
          const [, , , encoded_data] = trimmedUrl.split('/');
          const buff = Buffer.from(encoded_data, 'base64');
          const str = buff.toString('utf-8');
      
          // Parse the updated config from the string (assuming JSON format)
          const updatedConfigData = JSON.parse(str);
      
          // Process the updated configuration
          const updatedAudioServerConfig = processAudioServerConfig(updatedConfigData);
          
          // Return the empty command response
          return emptyCommand(trimmedUrl, { crc32: config.audioserver?.musicCRC, extensions: [] });
      
        } catch (error) {
          logger.error(`[${name}] Error processing setconfig: ${error}`);
          return emptyCommand(trimmedUrl, { crc32: config.audioserver?.musicCRC, extensions: [] });
        }
      

    case trimmedUrl.startsWith(AUDIO_GROUP):
      // audio/cfg/dgroup/update/new/14,14,15
      const [, , , command, type, Group] = trimmedUrl.split('/');
      sendGroupCommandToZone(command, type, Group);
      return emptyCommand(trimmedUrl, []);

    case new RegExp(`(?:^|/)${AUDIO_COMMANDS_PATTERN}(?:/|$)`).test(trimmedUrl): {
      const [, playerID, command, param] = trimmedUrl.split('/');
      sendCommandToZone(playerID, command, param);
      return `{"dgroup_update_result": {"id":"cc131c8a-a368-f320-da6d-2568b7314e8c"}, "command": "{trimmedUrl}"}`;
    }

    case new RegExp(`(?:^|/)${COMMAND_AUDIO_CFG_GET_KEY}(?:/|$)`).test(trimmedUrl):
      return audioCfgGetKey(trimmedUrl);

    case new RegExp(`(?:^|/)${COMMAND_AUDIO_CFG_GET_MEDIA_FOLDER}(?:/|$)`).test(trimmedUrl):
      return audioCfgGetMediaFolder(trimmedUrl);

    case new RegExp(`(?:^|/)${COMMAND_AUDIO_CFG_GET_PLAYLISTS}(?:/|$)`).test(trimmedUrl):
      return audioCfgGetPlaylists(trimmedUrl);

    case new RegExp(`(?:^|/)${COMMAND_AUDIO_CFG_GET_RADIOS}(?:/|$)`).test(trimmedUrl):
      return audioCfgGetRadios(trimmedUrl);

    case new RegExp(`(?:^|/)${COMMAND_AUDIO_CFG_GET_ROOM_FAVS}/`).test(trimmedUrl):
      return audioCfgGetRoomFavs(trimmedUrl);

    case new RegExp(`(?:^|/)${COMMAND_AUDIO_CFG_GET_SYNCED_PLAYERS}(?:/|$)`).test(trimmedUrl):
      return audioCfgGetSyncedPlayers(trimmedUrl);

    case new RegExp(`(?:^|/)${COMMAND_AUDIO_PLAYER_STATUS}(?:/|$)`).test(trimmedUrl):
      return audioGetStatus(trimmedUrl);

    case new RegExp(`(?:^|/)${COMMAND_AUDIO_CFG_GET_QUEUE}(?:/|$)`).test(trimmedUrl):
      return audioGetQueue(trimmedUrl);

    default:
      return unknownCommand(trimmedUrl); // Unknown command handler
  }
};

