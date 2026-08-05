import React from "react";
import { Image } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import CreateTripScreen from "../create";
import { createTrip, updateTrip, getTrip, subscribeToTravelers, createTraveler } from "../../../services/tripService";
import { requestLibraryPhoto, persistCoverPhoto, deleteCoverPhoto } from "../../../services/imageService";
import { getTodayDateString, formatDateForDisplay } from "../../../utils/dateUtils";

// Local service modules aren't node_modules packages, so Jest won't
// auto-apply a manual mock -- mock them explicitly. This also keeps this
// screen test from ever touching real Firebase, the real camera/library,
// or the real filesystem.
jest.mock("../../../services/tripService");
jest.mock("../../../services/placesService");
jest.mock("../../../services/imageService");

const TITLE_PLACEHOLDER = "e.g. Karaoke Night Downtown";

describe("Create/Edit Trip screen", () => {
  beforeEach(() => {
    createTrip.mockReset().mockResolvedValue("new-trip-1");
    updateTrip.mockReset().mockResolvedValue(undefined);
    getTrip.mockReset();
    createTraveler.mockReset();
    subscribeToTravelers.mockReset().mockImplementation((onChange) => {
      onChange([]);
      return () => {};
    });
    useLocalSearchParams.mockReturnValue({});
    useRouter().push.mockClear();
    useRouter().replace.mockClear();
    requestLibraryPhoto.mockReset();
    persistCoverPhoto.mockReset().mockResolvedValue("file:///mock-documents/tripCoverPhotos/new.jpg");
    deleteCoverPhoto.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("defaults to In-Town Concert with no transportation question shown", () => {
    render(<CreateTripScreen />);
    expect(screen.queryByText("How are you getting there?")).toBeNull();
    expect(screen.queryByText("How are you traveling to the departure city?")).toBeNull();
  });

  test("selecting Cruise relabels Destination and reveals optional Cruise Line / Ship Name fields", () => {
    render(<CreateTripScreen />);
    expect(screen.getByText("Destination")).toBeTruthy();
    expect(screen.queryByText("Departure City / Port")).toBeNull();
    expect(screen.queryByText("Cruise Line (optional)")).toBeNull();

    fireEvent.press(screen.getByText("Cruise"));

    expect(screen.queryByText("Destination")).toBeNull();
    expect(screen.getByText("Departure City / Port")).toBeTruthy();
    expect(screen.getByText("Cruise Line (optional)")).toBeTruthy();
    expect(screen.getByText("Ship Name (optional)")).toBeTruthy();
    // The location search field is the departure port/terminal, never "the venue".
    expect(screen.getByText("Departure Port or Terminal (optional)")).toBeTruthy();
  });

  test("Cruise Line and Ship Name are saved on the trip when creating a cruise", async () => {
    render(<CreateTripScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Caribbean Cruise");
    fireEvent.press(screen.getByText("Cruise"));
    fireEvent.press(screen.getByText("Flying")); // cruise's transportation-to-departure-city question
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Royal Caribbean"), "Royal Caribbean");
    fireEvent.changeText(screen.getByPlaceholderText("e.g. Wonder of the Seas"), "Wonder of the Seas");
    fireEvent.press(screen.getByText("Create Trip"));

    await waitFor(() => expect(createTrip).toHaveBeenCalledTimes(1));
    expect(createTrip.mock.calls[0][0]).toEqual(
      expect.objectContaining({ cruiseLine: "Royal Caribbean", shipName: "Wonder of the Seas" })
    );
  });

  test("blocks save and shows an error when the title is empty", async () => {
    render(<CreateTripScreen />);
    fireEvent.press(screen.getByText("Create Trip"));
    await waitFor(() => expect(screen.getByText("Trip title is required.")).toBeTruthy());
    expect(createTrip).not.toHaveBeenCalled();
  });

  test("selecting Out-of-Town Concert requires a transportation choice before saving", async () => {
    render(<CreateTripScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Weekend Trip");
    fireEvent.press(screen.getByText("Out-of-Town Concert"));

    expect(screen.getByText("How are you getting there?")).toBeTruthy();
    expect(screen.getByText("This choice customizes your checklist.")).toBeTruthy();

    fireEvent.press(screen.getByText("Create Trip"));
    await waitFor(() =>
      expect(screen.getByText("Choose a transportation option -- this customizes your checklist.")).toBeTruthy()
    );
    expect(createTrip).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Flying"));
    fireEvent.press(screen.getByText("Create Trip"));
    await waitFor(() => expect(createTrip).toHaveBeenCalledTimes(1));
    expect(createTrip.mock.calls[0][0].travelMode).toBe("flying");
    expect(createTrip.mock.calls[0][0].travelRequired).toBe(true);
  });

  test("fills required fields and creates the trip", async () => {
    render(<CreateTripScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Trivia Night");
    fireEvent.press(screen.getByText("Create Trip"));

    await waitFor(() => expect(createTrip).toHaveBeenCalledTimes(1));
    const savedData = createTrip.mock.calls[0][0];
    expect(savedData.title).toBe("Trivia Night");
    expect(savedData.eventType).toBe("inTownConcert");
    expect(savedData.travelRequired).toBe(false);

    await waitFor(() => expect(useRouter().replace).toHaveBeenCalledWith("/trips/new-trip-1"));
  });

  test("Start Date and End Date open the branded calendar picker and commit on Confirm", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 10, 12, 0, 0)); // "today" = Aug 10, 2026
    render(<CreateTripScreen />);

    // Start Date defaults to today (Aug 10, 2026) -- open its picker, pick
    // the 12th, and confirm. Start/End each have a distinct testID (see
    // create.js / DateField.js) so both the field and the picker beneath
    // it are unambiguous even with two DateFields on the same screen.
    fireEvent.press(screen.getByTestId("start-date"));
    fireEvent.press(screen.getByTestId("start-date-day-2026-08-12"));
    fireEvent.press(screen.getByTestId("start-date-confirm"));
    expect(screen.getByText("Aug 12, 2026")).toBeTruthy();

    // End Date -- open its picker and confirm a day after the new start date.
    fireEvent.press(screen.getByTestId("end-date"));
    fireEvent.press(screen.getByTestId("end-date-day-2026-08-20"));
    fireEvent.press(screen.getByTestId("end-date-confirm"));
    expect(screen.getByText("Aug 20, 2026")).toBeTruthy();
  });

  test("the calendar's month navigation moves forward and back without changing the selection", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 10, 12, 0, 0)); // "today" = Aug 10, 2026
    render(<CreateTripScreen />);

    fireEvent.press(screen.getByTestId("start-date"));
    expect(screen.getByText("August 2026")).toBeTruthy();

    fireEvent.press(screen.getByTestId("start-date-next-month"));
    expect(screen.getByText("September 2026")).toBeTruthy();

    fireEvent.press(screen.getByTestId("start-date-prev-month"));
    fireEvent.press(screen.getByTestId("start-date-prev-month"));
    expect(screen.getByText("July 2026")).toBeTruthy();

    // Navigating alone never commits anything -- Cancel leaves Start Date
    // exactly as it was (today).
    fireEvent.press(screen.getByTestId("start-date-cancel"));
    expect(screen.getByText("Aug 10, 2026")).toBeTruthy();
  });

  test("Cancel on the date picker discards the pending selection", () => {
    render(<CreateTripScreen />);
    const todayLabel = formatDateForDisplay(getTodayDateString());
    expect(screen.getByText(todayLabel)).toBeTruthy(); // Start Date defaults to today

    // Pick the 15th of whatever month is currently showing (every month
    // has one) so this doesn't depend on today's actual date, then Cancel.
    const [year, month] = getTodayDateString().split("-");
    fireEvent.press(screen.getByTestId("start-date"));
    fireEvent.press(screen.getByTestId(`start-date-day-${year}-${month}-15`));
    fireEvent.press(screen.getByTestId("start-date-cancel"));

    // Still today -- Cancel never called onChange.
    expect(screen.getByText(todayLabel)).toBeTruthy();
  });

  test("the End Date calendar marks days before the start date as disabled, preventing an invalid selection", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 10, 12, 0, 0)); // "today" = Aug 10, 2026
    render(<CreateTripScreen />);

    // Start Date is Aug 10, 2026 (today, unchanged) -- End Date's calendar
    // uses it as a minimumDate floor. This is UI-level prevention on top of
    // (not instead of) the isEndDateValid guard already covered by
    // utils/__tests__/dateUtils.test.js and still present in handleSave.
    fireEvent.press(screen.getByTestId("end-date"));

    const dayBeforeStart = screen.getByTestId("end-date-day-2026-08-05");
    expect(dayBeforeStart.props.accessibilityState.disabled).toBe(true);

    const dayOnStart = screen.getByTestId("end-date-day-2026-08-10");
    expect(dayOnStart.props.accessibilityState.disabled).toBe(false);
  });

  test("edit mode pre-fills the trip and saves via updateTrip, not createTrip", async () => {
    useLocalSearchParams.mockReturnValue({ editId: "trip-1" });
    getTrip.mockResolvedValue({
      id: "trip-1",
      title: "Existing Trip",
      eventType: "inTownConcert",
      travelRequired: false,
      startDate: "2026-08-10",
      endDate: "",
      destination: "",
      venue: "",
      address: "",
      notes: "",
      travelerIds: []
    });

    render(<CreateTripScreen />);
    await waitFor(() => expect(screen.getByDisplayValue("Existing Trip")).toBeTruthy());

    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() =>
      expect(updateTrip).toHaveBeenCalledWith("trip-1", expect.objectContaining({ title: "Existing Trip" }))
    );
    expect(createTrip).not.toHaveBeenCalled();
  });

  describe("Trip Cover Photo", () => {
    test("adding a cover photo includes its persistent uri in the created trip's payload", async () => {
      requestLibraryPhoto.mockResolvedValue({ status: "success", uri: "file:///cache/lib.jpg" });
      render(<CreateTripScreen />);
      fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Beach Day");

      fireEvent.press(screen.getByTestId("cover-photo-choose"));
      await waitFor(() => expect(screen.UNSAFE_getByType(Image)).toBeTruthy());

      fireEvent.press(screen.getByText("Create Trip"));
      await waitFor(() => expect(createTrip).toHaveBeenCalledTimes(1));
      expect(createTrip.mock.calls[0][0].coverPhotoUri).toBe("file:///mock-documents/tripCoverPhotos/new.jpg");
    });

    test("a trip created with no cover photo saves coverPhotoUri as null", async () => {
      render(<CreateTripScreen />);
      fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "No Photo Trip");
      fireEvent.press(screen.getByText("Create Trip"));
      await waitFor(() => expect(createTrip).toHaveBeenCalledTimes(1));
      expect(createTrip.mock.calls[0][0].coverPhotoUri).toBeNull();
    });

    test("edit mode loads and previews the trip's already-saved cover photo", async () => {
      useLocalSearchParams.mockReturnValue({ editId: "trip-photo" });
      getTrip.mockResolvedValue({
        id: "trip-photo",
        title: "Trip With Photo",
        eventType: "inTownConcert",
        travelRequired: false,
        startDate: "2026-08-10",
        endDate: "",
        destination: "",
        venue: "",
        address: "",
        notes: "",
        travelerIds: [],
        coverPhotoUri: "file:///mock-documents/tripCoverPhotos/existing.jpg"
      });

      render(<CreateTripScreen />);
      await waitFor(() => expect(screen.getByDisplayValue("Trip With Photo")).toBeTruthy());

      const image = screen.UNSAFE_getByType(Image);
      expect(image.props.source).toEqual({ uri: "file:///mock-documents/tripCoverPhotos/existing.jpg" });
      expect(image.props.accessibilityLabel).toBe("Trip cover photo");
    });

    test("existing trips without a cover photo load and save fine -- no crash, no stray Image", async () => {
      useLocalSearchParams.mockReturnValue({ editId: "trip-no-photo" });
      getTrip.mockResolvedValue({
        id: "trip-no-photo",
        title: "Plain Trip",
        eventType: "inTownConcert",
        travelRequired: false,
        startDate: "2026-08-10",
        endDate: "",
        destination: "",
        venue: "",
        address: "",
        notes: "",
        travelerIds: []
        // no coverPhotoUri field at all, same as every trip saved before this feature existed
      });

      render(<CreateTripScreen />);
      await waitFor(() => expect(screen.getByDisplayValue("Plain Trip")).toBeTruthy());
      expect(screen.queryByLabelText("Trip cover photo")).toBeNull();

      fireEvent.press(screen.getByText("Save Changes"));
      await waitFor(() => expect(updateTrip).toHaveBeenCalledTimes(1));
      expect(updateTrip.mock.calls[0][1].coverPhotoUri).toBeNull();
      expect(deleteCoverPhoto).not.toHaveBeenCalled();
    });

    test("removing an existing trip's cover photo and saving deletes the old persisted file", async () => {
      useLocalSearchParams.mockReturnValue({ editId: "trip-photo" });
      getTrip.mockResolvedValue({
        id: "trip-photo",
        title: "Trip With Photo",
        eventType: "inTownConcert",
        travelRequired: false,
        startDate: "2026-08-10",
        endDate: "",
        destination: "",
        venue: "",
        address: "",
        notes: "",
        travelerIds: [],
        coverPhotoUri: "file:///mock-documents/tripCoverPhotos/existing.jpg"
      });

      render(<CreateTripScreen />);
      await waitFor(() => expect(screen.getByDisplayValue("Trip With Photo")).toBeTruthy());

      fireEvent.press(screen.getByTestId("cover-photo-remove"));
      expect(screen.queryByLabelText("Trip cover photo")).toBeNull();

      fireEvent.press(screen.getByText("Save Changes"));
      await waitFor(() => expect(updateTrip).toHaveBeenCalledTimes(1));
      expect(updateTrip.mock.calls[0][1].coverPhotoUri).toBeNull();
      expect(deleteCoverPhoto).toHaveBeenCalledWith("file:///mock-documents/tripCoverPhotos/existing.jpg");
    });
  });
});
