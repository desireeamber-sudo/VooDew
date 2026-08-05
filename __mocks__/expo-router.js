// Manual mock for expo-router. Screens under test call useRouter()/
// useLocalSearchParams() -- both return plain jest.fn()-backed values that
// individual tests can inspect (`router.push`) or override
// (`useLocalSearchParams.mockReturnValue({ tripId: "abc" })`).
import React from "react";

const router = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true)
};

export const useRouter = jest.fn(() => router);
export const useLocalSearchParams = jest.fn(() => ({}));
export const useFocusEffect = jest.fn();

export function Link({ children }) {
  return children || null;
}

export function Stack({ children }) {
  return children || null;
}
// jest.fn() (not a plain function) so tests can assert on the `options`
// prop a screen passes it -- e.g. Create/Edit Trip's dynamic header title.
// Still renders null either way; nothing about the mocked navigator itself
// changes.
Stack.Screen = jest.fn(() => null);
