// Manual mock for expo-notifications. Every reminder test runs against
// these stubs -- no real OS notification is ever scheduled.
export const setNotificationHandler = jest.fn();
export const getPermissionsAsync = jest.fn(async () => ({ status: "granted" }));
export const requestPermissionsAsync = jest.fn(async () => ({ status: "granted" }));
export const scheduleNotificationAsync = jest.fn(async () => "mock-notification-id");
export const cancelScheduledNotificationAsync = jest.fn(async () => undefined);
export const setNotificationChannelAsync = jest.fn(async () => undefined);
export const addNotificationReceivedListener = jest.fn(() => ({ remove: jest.fn() }));
export const AndroidImportance = { HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 };
