// Manual mock for `firebase/app`, used by services/firebase.js at import
// time. Keeps module import side-effect-free in tests -- nothing here
// ever reaches a real Firebase project.
export const initializeApp = jest.fn(() => ({ __type: "firebaseApp" }));
export const getApps = jest.fn(() => []);
export const getApp = jest.fn(() => ({ __type: "firebaseApp" }));
