import React from "react";
import { Image } from "react-native";
import { render, screen } from "@testing-library/react-native";
import HomeScreen from "../index";
import { subscribeToTrips } from "../../services/tripService";

jest.mock("../../services/tripService");

describe("Home screen", () => {
  beforeEach(() => {
    subscribeToTrips.mockReset().mockImplementation((onChange) => {
      onChange([]);
      return () => {};
    });
  });

  test("renders the Trip VooDew logo using React Native's Image component", () => {
    render(<HomeScreen />);
    const images = screen.UNSAFE_getAllByType(Image);
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].props.accessibilityLabel).toBe("Trip VooDew logo");
  });

  // Branding consistency: the header used to read the bare "VooDew" -- now
  // matches the app name used everywhere else ("Trip VooDew").
  test("renders 'Trip VooDew' as the app title, not the old 'VooDew'", () => {
    render(<HomeScreen />);
    expect(screen.getByText("Trip VooDew")).toBeTruthy();
    expect(screen.queryByText("VooDew")).toBeNull();
  });
});
