// Manual mock for expo-file-system. No test ever touches a real
// filesystem -- copyAsync/getInfoAsync/makeDirectoryAsync/deleteAsync are
// jest.fn()s with sensible default resolved values so
// services/__tests__/imageService.test.js can exercise the real
// services/imageService.js logic without disk I/O.
export const documentDirectory = "file:///mock-documents/";

export const getInfoAsync = jest.fn(async () => ({ exists: true }));
export const makeDirectoryAsync = jest.fn(async () => {});
export const copyAsync = jest.fn(async () => {});
export const deleteAsync = jest.fn(async () => {});
