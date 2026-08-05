// Manual mock for expo-image-picker. No real camera or photo library is
// ever opened in tests -- services/__tests__/imageService.test.js
// overrides these jest.fn()s' resolved values per test; everywhere else
// (CoverPhotoField, create.js) mocks services/imageService.js directly
// instead, so this file mainly exists so a bare `import * as ImagePicker
// from "expo-image-picker"` never crashes Jest with a missing-module error.
export const MediaTypeOptions = { Images: "Images" };
export const CameraType = { back: "back", front: "front" };

export const getCameraPermissionsAsync = jest.fn(async () => ({ status: "granted", granted: true }));
export const requestCameraPermissionsAsync = jest.fn(async () => ({ status: "granted", granted: true }));
export const requestMediaLibraryPermissionsAsync = jest.fn(async () => ({ status: "granted" }));

export const launchCameraAsync = jest.fn(async () => ({
  canceled: false,
  assets: [{ uri: "file:///mock-cache/camera-photo.jpg" }]
}));

export const launchImageLibraryAsync = jest.fn(async () => ({
  canceled: false,
  assets: [{ uri: "file:///mock-cache/library-photo.jpg" }]
}));

export const getPendingResultAsync = jest.fn(async () => []);
