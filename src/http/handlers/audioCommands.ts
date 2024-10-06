import { response, emptyCommand } from './requesthandler';
import { getZoneById } from '../../backend/zonemanager';
import { config } from '../../config/config';
import NodeRSA from 'node-rsa';

const rsaKey = new NodeRSA({ b: 2048 });
rsaKey.setOptions({ encryptionScheme: 'pkcs1' });

export function audioCfgReady(url: string) {
    const sessionData = { session: 547541322864 };
    return emptyCommand(url, sessionData);
}

export function audioCfgGetConfig(url: string) {
    const configData = {
        crc32: config.audioserver?.musicCRC,
        extensions: []
    };
    return emptyCommand(url, configData);
}

export function audioCfgGetKey(url: string) {
    const publicKeyComponents = rsaKey.exportKey('components-public');
    const data = [
        {
            pubkey: publicKeyComponents.n.toString('hex'), // Convert Buffer to hex string
            exp: publicKeyComponents.e, // Public exponent (number)
        },
    ];
    return emptyCommand(url, data);
}

export function audioGetStatus(url: string) {
    const [, zoneId] = url.split('/');
    const zone = getZoneById(zoneId);
    
    if (!zone) {
        return emptyCommand(url, { error: 'Zone not found' });
    }
    
    const statusData = [zone.track];
    return response(url, 'status', statusData);
}

// ZOOI //

export function audioCfgGetMediaFolder(url: string) {
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

export function audioCfgGetRoomFavs(url: string) {
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

  export function audioCfgGetRadios(url: string) {
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