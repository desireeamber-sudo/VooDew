// Manual mock for expo-location. No real device location or Google
// geocoding request is ever made in tests.
export const requestForegroundPermissionsAsync = jest.fn(async () => ({ status: "granted" }));
export const getCurrentPositionAsync = jest.fn(async () => ({
  coords: { latitude: 36.1156, longitude: -95.9996 }
}));
export const geocodeAsync = jest.fn(async () => [{ latitude: 36.1156, longitude: -95.9996 }]);
