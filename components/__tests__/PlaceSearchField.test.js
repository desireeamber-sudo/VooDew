import React from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import PlaceSearchField from "../PlaceSearchField";
import { searchPlaces } from "../../services/placesService";

// services/placesService.js makes a real fetch() to Google Places -- always
// mock it so this test never contacts a real Google API.
jest.mock("../../services/placesService");

const SEARCH_PLACEHOLDER = "Search for a venue or address";

const BOK_RESULT = {
  placeId: "place-bok",
  name: "BOK Center",
  formattedAddress: "200 S Denver Ave W, Tulsa, OK 74103",
  latitude: 36.1156,
  longitude: -95.9996,
  city: "Tulsa",
  state: "OK"
};

describe("PlaceSearchField", () => {
  beforeEach(() => {
    searchPlaces.mockReset();
  });

  test("does not search until at least 2 characters are typed", () => {
    render(<PlaceSearchField value={null} onSelect={jest.fn()} onClear={jest.fn()} />);
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "B");
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  test("searches (debounced) and lists results once typing settles", async () => {
    searchPlaces.mockResolvedValue([BOK_RESULT]);
    render(<PlaceSearchField value={null} onSelect={jest.fn()} onClear={jest.fn()} />);
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "BOK Center");

    await waitFor(() => expect(searchPlaces).toHaveBeenCalledWith("BOK Center"), { timeout: 2000 });
    await waitFor(() => expect(screen.getByText("BOK Center")).toBeTruthy(), { timeout: 2000 });
    expect(screen.getByText("200 S Denver Ave W, Tulsa, OK 74103")).toBeTruthy();
  });

  test("never auto-selects a typed result -- selecting requires tapping the result card", async () => {
    const onSelect = jest.fn();
    searchPlaces.mockResolvedValue([BOK_RESULT]);
    render(<PlaceSearchField value={null} onSelect={onSelect} onClear={jest.fn()} />);
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "BOK Center");

    await waitFor(() => expect(screen.getByText("BOK Center")).toBeTruthy(), { timeout: 2000 });
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("BOK Center"));
    expect(onSelect).toHaveBeenCalledWith(BOK_RESULT);
  });

  test("shows a 'no matches' hint when the search resolves empty", async () => {
    searchPlaces.mockResolvedValue([]);
    render(<PlaceSearchField value={null} onSelect={jest.fn()} onClear={jest.fn()} />);
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "Nowhere Place");

    await waitFor(() => expect(screen.getByText(/No matches found/)).toBeTruthy(), { timeout: 2000 });
  });

  test("shows an error message when the search fails", async () => {
    searchPlaces.mockRejectedValue(new Error("Couldn't reach Google Places -- check your internet connection."));
    render(<PlaceSearchField value={null} onSelect={jest.fn()} onClear={jest.fn()} />);
    fireEvent.changeText(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), "BOK Center");

    await waitFor(
      () => expect(screen.getByText("Couldn't reach Google Places -- check your internet connection.")).toBeTruthy(),
      { timeout: 2000 }
    );
  });

  test("shows a compact summary card instead of the search box once a place is selected", () => {
    render(
      <PlaceSearchField
        value={{ name: "BOK Center", formattedAddress: "200 S Denver Ave W, Tulsa, OK 74103" }}
        onSelect={jest.fn()}
        onClear={jest.fn()}
      />
    );
    expect(screen.getByText("BOK Center")).toBeTruthy();
    expect(screen.queryByPlaceholderText(SEARCH_PLACEHOLDER)).toBeNull();
  });

  test("pressing 'Change' on the summary card calls onClear", () => {
    const onClear = jest.fn();
    render(
      <PlaceSearchField
        value={{ name: "BOK Center", formattedAddress: "200 S Denver Ave W, Tulsa, OK 74103" }}
        onSelect={jest.fn()}
        onClear={onClear}
      />
    );
    fireEvent.press(screen.getByText("Change"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test("shows the manual-entry fallback link only when onManualEntry is provided", () => {
    const onManualEntry = jest.fn();
    const { rerender } = render(<PlaceSearchField value={null} onSelect={jest.fn()} onClear={jest.fn()} />);
    expect(screen.queryByText("Enter location manually instead")).toBeNull();

    rerender(<PlaceSearchField value={null} onSelect={jest.fn()} onClear={jest.fn()} onManualEntry={onManualEntry} />);
    fireEvent.press(screen.getByText("Enter location manually instead"));
    expect(onManualEntry).toHaveBeenCalledTimes(1);
  });
});
