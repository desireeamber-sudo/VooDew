// Shared type scale. Screen titles, section titles, and body text should
// all pull from here so sizing stays consistent app-wide.
export const typography = {
  fontFamily: undefined, // uses the platform default sans-serif; swap in a custom font here if one is added later
  screenTitle: { fontSize: 28, fontWeight: "700" },
  sectionTitle: { fontSize: 19, fontWeight: "600" },
  cardTitle: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400" },
  caption: { fontSize: 12, fontWeight: "500" }
};

export default typography;
