import React from "react";
import { Image, Alert } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import TripDashboardScreen from "../index";
import { subscribeToTrip, subscribeToChecklist, subscribeToReminders, deleteTrip } from "../../../../services/tripService";
import { cancelLocalReminder } from "../../../../services/notificationService";
import { deleteCoverPhoto } from "../../../../services/imageService";

jest.mock("../../../../services/tripService");
jest.mock("../../../../services/notificationService");
jest.mock("../../../../services/imageService");

const BASE_TRIP = {
  id: "trip-1",
  title: "Weekend Getaway",
  eventType: "inTownConcert",
  startDate: "2026-08-20",
  endDate: ""
};

describe("Trip Dashboard cover photo", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ tripId: "trip-1" });
    subscribeToChecklist.mockReset().mockImplementation((tripId, onChange) => {
      onChange([]);
      return () => {};
    });
    subscribeToReminders.mockReset().mockImplementation((tripId, onChange) => {
      onChange([]);
      return () => {};
    });
    deleteTrip.mockReset().mockResolvedValue(undefined);
    cancelLocalReminder.mockReset().mockResolvedValue(undefined);
    deleteCoverPhoto.mockReset().mockResolvedValue(undefined);
    useRouter().replace.mockClear();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  test("renders the cover photo via Image when the trip has one", () => {
    subscribeToTrip.mockImplementation((tripId, onChange) => {
      onChange({ ...BASE_TRIP, coverPhotoUri: "file:///mock-documents/tripCoverPhotos/hero.jpg" });
      return () => {};
    });
    render(<TripDashboardScreen />);

    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: "file:///mock-documents/tripCoverPhotos/hero.jpg" });
    expect(image.props.accessibilityLabel).toBe("Trip cover photo");
  });

  test("an existing trip with no cover photo renders with no crash and no stray image", () => {
    subscribeToTrip.mockImplementation((tripId, onChange) => {
      onChange({ ...BASE_TRIP });
      return () => {};
    });
    render(<TripDashboardScreen />);

    expect(screen.getByText("Weekend Getaway")).toBeTruthy();
    expect(screen.queryByLabelText("Trip cover photo")).toBeNull();
  });

  test("deleting a trip with a cover photo also best-effort deletes the local file", async () => {
    subscribeToTrip.mockImplementation((tripId, onChange) => {
      onChange({ ...BASE_TRIP, coverPhotoUri: "file:///mock-documents/tripCoverPhotos/hero.jpg" });
      return () => {};
    });
    render(<TripDashboardScreen />);

    fireEvent.press(screen.getByText("Delete Trip"));
    const buttons = Alert.alert.mock.calls[0][2];
    const confirmButton = buttons.find((b) => b.text === "Delete");
    await confirmButton.onPress();

    expect(deleteTrip).toHaveBeenCalledWith("trip-1");
    expect(deleteCoverPhoto).toHaveBeenCalledWith("file:///mock-documents/tripCoverPhotos/hero.jpg");
  });

  test("deleting a trip with no cover photo never crashes and calls deleteCoverPhoto with undefined", async () => {
    subscribeToTrip.mockImplementation((tripId, onChange) => {
      onChange({ ...BASE_TRIP });
      return () => {};
    });
    render(<TripDashboardScreen />);

    fireEvent.press(screen.getByText("Delete Trip"));
    const buttons = Alert.alert.mock.calls[0][2];
    const confirmButton = buttons.find((b) => b.text === "Delete");
    await expect(confirmButton.onPress()).resolves.toBeUndefined();

    expect(deleteTrip).toHaveBeenCalledWith("trip-1");
  });
});
