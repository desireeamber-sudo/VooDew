// Wraps expo-location for the small set of things the map/create screens
// need: permission handling and (optionally) forward geocoding an address
// typed by the user into latitude/longitude for the map marker.
import * as Location from "expo-location";

export async function requestLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentPosition() {
  const granted = await requestLocationPermission();
  if (!granted) return null;
  const position = await Location.getCurrentPositionAsync({});
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

/**
 * Converts a typed address into coordinates so it can be pinned on the map.
 * Returns null if geocoding fails or permission is denied -- callers should
 * fall back to letting the user drop/adjust the pin manually.
 */
export async function geocodeAddress(address) {
  if (!address) return null;
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;
    const results = await Location.geocodeAsync(address);
    if (!results || results.length === 0) return null;
    return { latitude: results[0].latitude, longitude: results[0].longitude };
  } catch (e) {
    return null;
  }
}
