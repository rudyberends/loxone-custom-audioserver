import Backend from './backendBaseClass'; // Import the base class for backends
import BackendBeolink from './Beolink/backend'; // Import Beolink backend
import BackendSonos from './Sonos/backend'; // Import Sonos backend
import BackendExample from './Example/backend';
// Add other backends here

/**
 * Type representing a constructor for a class that extends Backend.
 */
type BackendConstructor = new (ip: string, playerId: string) => Backend;

/**
 * Mapping of backend names to their corresponding classes.
 */
const backendMap: Record<string, BackendConstructor> = {
  BackendBeolink,
  BackendSonos,
  BackendExample,
  // Add other backends here
};

/**
 * Creates an instance of the specified backend class.
 *
 * @param {string} backendName - The name of the backend class to instantiate.
 * @param {string} ip - The IP address of the backend device.
 * @param {string} playerId - The unique identifier for the player.
 * @returns {Backend | null} - Returns an instance of the backend class if found; otherwise, null.
 */
export function createBackend(backendName: string, ip: string, playerId: string): Backend | null {
  const BackendClass = backendMap[backendName]; // Lookup the backend class by name
  return BackendClass ? new BackendClass(ip, playerId) : null; // Instantiate the class if found
}
