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
});
