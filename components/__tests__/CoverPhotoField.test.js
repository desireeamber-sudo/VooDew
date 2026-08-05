import React from "react";
import { Image } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import CoverPhotoField from "../CoverPhotoField";
import { requestCameraPhoto, requestLibraryPhoto, persistCoverPhoto } from "../../services/imageService";

// A local module, not a node_modules package -- Jest won't auto-apply a
// manual mock, so mock it explicitly. This keeps the component test from
// ever touching expo-image-picker/expo-file-system directly (those are
// covered on their own in services/__tests__/imageService.test.js).
jest.mock("../../services/imageService");

describe("CoverPhotoField", () => {
  beforeEach(() => {
    requestCameraPhoto.mockReset();
    requestLibraryPhoto.mockReset();
    persistCoverPhoto.mockReset().mockResolvedValue("file:///mock-documents/tripCoverPhotos/new.jpg");
  });

  test("shows Take Photo / Choose from Library and no preview when there is no photo yet", () => {
    render(<CoverPhotoField uri={null} onChange={() => {}} />);
    expect(screen.getByText("Take Photo")).toBeTruthy();
    expect(screen.getByText("Choose from Library")).toBeTruthy();
    expect(screen.queryByLabelText("Trip cover photo")).toBeNull();
    expect(screen.queryByTestId("cover-photo-remove")).toBeNull();
  });

  test("selecting a photo from the library persists it and hands the persistent uri to onChange", async () => {
    requestLibraryPhoto.mockResolvedValue({ status: "success", uri: "file:///cache/lib.jpg" });
    const onChange = jest.fn();
    render(<CoverPhotoField uri={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId("cover-photo-choose"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("file:///mock-documents/tripCoverPhotos/new.jpg"));
    expect(persistCoverPhoto).toHaveBeenCalledWith("file:///cache/lib.jpg");
  });

  test("taking a photo with the camera persists it and hands the persistent uri to onChange", async () => {
    requestCameraPhoto.mockResolvedValue({ status: "success", uri: "file:///cache/cam.jpg" });
    const onChange = jest.fn();
    render(<CoverPhotoField uri={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId("cover-photo-take"));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("file:///mock-documents/tripCoverPhotos/new.jpg"));
    expect(persistCoverPhoto).toHaveBeenCalledWith("file:///cache/cam.jpg");
  });

  test("an existing uri renders the preview through React Native's Image component", () => {
    render(<CoverPhotoField uri="file:///mock-documents/tripCoverPhotos/existing.jpg" onChange={() => {}} />);
    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: "file:///mock-documents/tripCoverPhotos/existing.jpg" });
    expect(image.props.accessibilityLabel).toBe("Trip cover photo");
  });

  test("Remove Photo clears the preview", () => {
    const onChange = jest.fn();
    render(<CoverPhotoField uri="file:///mock-documents/tripCoverPhotos/existing.jpg" onChange={onChange} />);

    fireEvent.press(screen.getByTestId("cover-photo-remove"));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  test("denied camera permission shows an explanation instead of crashing, and never calls onChange", async () => {
    requestCameraPhoto.mockResolvedValue({ status: "denied" });
    const onChange = jest.fn();
    render(<CoverPhotoField uri={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId("cover-photo-take"));

    await waitFor(() => expect(screen.getByText(/camera access/i)).toBeTruthy());
    expect(onChange).not.toHaveBeenCalled();
    expect(persistCoverPhoto).not.toHaveBeenCalled();
  });

  test("denied library permission shows an explanation instead of crashing", async () => {
    requestLibraryPhoto.mockResolvedValue({ status: "denied" });
    render(<CoverPhotoField uri={null} onChange={() => {}} />);

    fireEvent.press(screen.getByTestId("cover-photo-choose"));

    await waitFor(() => expect(screen.getByText(/photo library access/i)).toBeTruthy());
  });

  test("a camera launch error (e.g. a hung/broken emulator camera) shows a clear message and clears the loading state", async () => {
    requestCameraPhoto.mockResolvedValue({
      status: "error",
      message: "The camera didn't respond. Try Choose from Library instead."
    });
    const onChange = jest.fn();
    render(<CoverPhotoField uri={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId("cover-photo-take"));

    await waitFor(() =>
      expect(screen.getByText("The camera didn't respond. Try Choose from Library instead.")).toBeTruthy()
    );
    expect(onChange).not.toHaveBeenCalled();
    // The button is no longer stuck loading/disabled -- safe to press again.
    expect(screen.getByTestId("cover-photo-take").props.accessibilityState.disabled).toBe(false);
  });

  test("cancelling the picker leaves the field unchanged with no error shown", async () => {
    requestLibraryPhoto.mockResolvedValue({ status: "cancelled" });
    const onChange = jest.fn();
    render(<CoverPhotoField uri={null} onChange={onChange} />);

    fireEvent.press(screen.getByTestId("cover-photo-choose"));

    await waitFor(() => expect(requestLibraryPhoto).toHaveBeenCalled());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/access/i)).toBeNull();
  });
});
