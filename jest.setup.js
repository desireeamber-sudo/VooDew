// Global test setup, run once per test file before the test framework
// is installed. Keep this minimal -- jest-expo's preset already handles
// the standard React Native environment shims.

// @testing-library/react-native v12 ships its own matchers
// (toBeOnTheScreen, toHaveTextContent, etc.) automatically; no
// `@testing-library/jest-native/extend-expect` import needed.
