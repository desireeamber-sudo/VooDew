// transformIgnorePatterns is deliberately NOT set here. The "jest-expo"
// preset already ships a correct one (see node_modules/jest-expo/jest-preset.js)
// that properly transforms every "expo-*" package, including
// expo-modules-core. An earlier version of this file redefined it by hand
// and introduced a regex bug: wrapping the whole alternation in a shared
// `(...)/ ` group requires whatever matched to be immediately followed by
// a literal "/". That's fine for entries like "@expo/.*", but it broke the
// bare `expo(nent)?` alternative for any hyphenated package -- it matches
// "expo" in "expo-modules-core", then fails because the next character is
// "-", not "/". expo-modules-core fell into the "don't transform" bucket,
// Jest tried to require() its untranspiled ESM `export` syntax as
// CommonJS, and every suite failed before a single test ran
// ("SyntaxError: Unexpected token 'export'"). Setting a project-level
// transformIgnorePatterns REPLACES the preset's value for that key
// entirely (Jest does not merge preset + project config per key), so this
// key must either be left unset (as below) or copied byte-for-byte correct
// -- overriding it "for extra packages" is exactly how this broke.
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.js"],
  collectCoverageFrom: [
    "utils/**/*.js",
    "services/**/*.js",
    "components/**/*.js",
    "app/**/*.js",
    "!**/node_modules/**"
  ],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/", "/.maestro/"]
};
