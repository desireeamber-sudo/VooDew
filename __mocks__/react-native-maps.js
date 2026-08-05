// Manual mock for react-native-maps. Jest can't render a real native
// Google/Apple map, so MapView and Marker become plain Views that just
// pass their props/children through -- enough for map.js's tests to
// assert a marker exists with the right coordinate/title without ever
// touching a real Maps SDK.
import React from "react";
import { View } from "react-native";

function MockMapView(props) {
  return <View testID="mock-map-view" {...props} />;
}

function MockMarker(props) {
  return <View testID="mock-map-marker" {...props} />;
}

MockMapView.Marker = MockMarker;

export default MockMapView;
export const Marker = MockMarker;
export const PROVIDER_GOOGLE = "google";
