import React from "react";
import { Image } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
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
    useRouter().back.mockClear();
    useRouter().canGoBack.mockClear().mockReturnValue(true);
    Stack.Screen.mockClear();
    requestLibraryPhoto.mockReset();
    persistCoverPhoto.mockReset().mockResolvedValue("file:///mock-documents/tripCoverPhotos/new.jpg");
    deleteCoverPhoto.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("Screen polish: dynamic title, sticky button, dates row", () => {
    function lastStackScreenTitle() {
      const calls = Stack.Screen.mock.calls;
      return calls[calls.length - 1][0].options.title;
    }

    test("screen title is 'Create Trip' when creating a new trip", () => {
      render(<CreateTripScreen />);
      expect(lastStackScreenTitle()).toBe("Create Trip");
    });

    test("screen title is 'Edit Trip' when editing an existing trip", async () => {
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
      // The title reflects edit mode immediately -- it only depends on the
      // editId param being present, not on the trip data finishing its load.
      expect(lastStackScreenTitle()).toBe("Edit Trip");
      await waitFor(() => expect(screen.getByDisplayValue("Existing Trip")).toBeTruthy());
    });

    test("the sticky save button reads 'Create Trip' in create mode and 'Save Changes' in edit mode", async () => {
      const { unmount } = render(<CreateTripScreen />);
      expect(screen.getByTestId("save-trip-button")).toBeTruthy();
      expect(screen.getByText("Create Trip")).toBeTruthy();
      unmount();

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
      expect(screen.getByTestId("save-trip-button")).toBeTruthy();
      expect(screen.getByText("Save Changes")).toBeTruthy();
    });

    test("Start Date and End Date are displayed side by side in one row", () => {
      render(<CreateTripScreen />);
      const row = screen.getByTestId("date-row");
      const flatStyle = Array.isArray(row.props.style) ? Object.assign({}, ...row.props.style) : row.props.style;
      expect(flatStyle.flexDirection).toBe("row");
      // Both fields are inside that same row.
      expect(screen.getByTestId("start-date")).toBeTruthy();
      expect(screen.getByTestId("end-date")).toBeTruthy();
    });
  });

  describe("Screen polish: collapsible sections default by mode", () => {
    test("create mode: Event Type, Travelers, and Notes all start expanded", () => {
      render(<CreateTripScreen />);
      expect(screen.getByTestId("event-type-section-toggle").props.accessibilityState.expanded).toBe(true);
      expect(screen.getByTestId("travelers-section-toggle").props.accessibilityState.expanded).toBe(true);
      expect(screen.getByTestId("notes-section-toggle").props.accessibilityState.expanded).toBe(true);
      // The event type chips are already visible -- no tap needed.
      expect(screen.getByText("Cruise")).toBeTruthy();
    });

    test("edit mode: Event Type, Travelers, and Notes all start collapsed, with Event Type's subtitle showing the loaded trip's type", async () => {
      useLocalSearchParams.mockReturnValue({ editId: "trip-1" });
      getTrip.mockResolvedValue({
        id: "trip-1",
        title: "Existing Trip",
        eventType: "cruise",
        travelRequired: true,
        travelMode: "flying",
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

      expect(screen.getByTestId("event-type-section-toggle").props.accessibilityState.expanded).toBe(false);
      expect(screen.getByTestId("travelers-section-toggle").props.accessibilityState.expanded).toBe(false);
      expect(screen.getByTestId("notes-section-toggle").props.accessibilityState.expanded).toBe(false);
      // Collapsed, so the only "Cruise" on screen is the subtitle -- the
      // chip itself isn't rendered until the section is expanded.
      expect(screen.getByText("Cruise")).toBeTruthy();

      fireEvent.press(screen.getByTestId("event-type-section-toggle"));
      expect(screen.getByTestId("event-type-section-toggle").props.accessibilityState.expanded).toBe(true);
      // Now both the subtitle and the (now-visible) selected chip say "Cruise".
      expect(screen.getAllByText("Cruise").length).toBeGreaterThanOrEqual(2);
    });
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

  // The sticky save button is now disabled (not just validated-on-press)
  // whenever a required field is missing -- "Create Trip" no longer
  // fires handleSave (and therefore never shows an inline error) while
  // the title is empty, since there's nothing to press.
  test("Create Trip is disabled while the title is empty, and enables once one is entered", () => {
    render(<CreateTripScreen />);
    expect(screen.getByTestId("save-trip-button").props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Trivia Night");
    expect(screen.getByTestId("save-trip-button").props.accessibilityState.disabled).toBe(false);
  });

  test("selecting Out-of-Town Concert requires a transportation choice before Create Trip is enabled", async () => {
    render(<CreateTripScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Weekend Trip");
    fireEvent.press(screen.getByText("Out-of-Town Concert"));

    expect(screen.getByText("How are you getting there?")).toBeTruthy();
    expect(screen.getByText("This choice customizes your checklist.")).toBeTruthy();
    // Title is filled, but a transportation choice is still required for
    // this event type and hasn't been made yet -- disabled.
    expect(screen.getByTestId("save-trip-button").props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByText("Flying"));
    expect(screen.getByTestId("save-trip-button").props.accessibilityState.disabled).toBe(false);

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

    // Save Changes stays disabled until something actually changes (see
    // the dedicated "disabled until changed" test below) -- edit a field
    // first so this test can exercise the actual save.
    fireEvent.changeText(screen.getByDisplayValue("Existing Trip"), "Existing Trip Updated");
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() =>
      expect(updateTrip).toHaveBeenCalledWith("trip-1", expect.objectContaining({ title: "Existing Trip Updated" }))
    );
    expect(createTrip).not.toHaveBeenCalled();
  });

  // Requirement: in edit mode, Save Changes stays disabled until the form
  // differs from the trip as it was loaded -- pressing it with no changes
  // made should not be possible, and should never call updateTrip.
  test("edit mode: Save Changes is disabled until the form differs from the loaded trip", async () => {
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

    const button = screen.getByTestId("save-trip-button");
    expect(button.props.accessibilityState.disabled).toBe(true);
    // AppButton's own implementation never wires onPress through while
    // disabled (see components/AppButton.js), so a disabled button here
    // is sufficient proof updateTrip can't be reached -- not re-asserted
    // via a press.
    expect(updateTrip).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByDisplayValue("Existing Trip"), "Existing Trip Updated");
    expect(screen.getByTestId("save-trip-button").props.accessibilityState.disabled).toBe(false);

    // Changing it back to exactly the original value re-disables it --
    // "differs from the loaded trip" means differs right now, not "was
    // ever edited".
    fireEvent.changeText(screen.getByDisplayValue("Existing Trip Updated"), "Existing Trip");
    expect(screen.getByTestId("save-trip-button").props.accessibilityState.disabled).toBe(true);
  });

  // Regression test: Edit is always reached by *pushing* from that trip's
  // own Dashboard (app/trips/[tripId]/index.js's pencil icon), so the
  // Dashboard is already directly underneath Edit on the navigation stack.
  // Saving used to call router.replace(`/trips/${editId}`), which swaps
  // Edit for a *second* Dashboard screen instead of revealing the one
  // already beneath it -- leaving a duplicate entry that needed Back
  // pressed twice (Dashboard -> Dashboard -> Home) instead of once
  // (Dashboard -> Home). router.back() pops Edit off and reveals the
  // existing Dashboard directly, so there's nothing left to duplicate.
  test("Home -> Dashboard -> Edit -> Save returns to the existing Dashboard via back(), not a new pushed/replaced one", async () => {
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

    // Save Changes stays disabled until something changes -- edit a field
    // first so this test can actually reach the save/navigation path.
    fireEvent.changeText(screen.getByDisplayValue("Existing Trip"), "Existing Trip Updated");
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => expect(updateTrip).toHaveBeenCalledTimes(1));

    // One Back action (router.back()) is how a duplicate Dashboard entry is
    // avoided -- it pops Edit off the stack and reveals the Dashboard
    // that's already underneath it, so Home is exactly one Back away from
    // that Dashboard, with no extra entry in between.
    expect(useRouter().back).toHaveBeenCalledTimes(1);
    // Neither push nor replace should navigate to a trips/<id> dashboard
    // route here -- either one would create the second, duplicate entry
    // this test exists to catch.
    expect(useRouter().push).not.toHaveBeenCalledWith(expect.stringContaining("/trips/trip-1"));
    expect(useRouter().replace).not.toHaveBeenCalledWith(expect.stringContaining("/trips/trip-1"));
  });

  test("falls back to router.replace() when there's nothing to go back to (e.g. Edit reached without a Dashboard beneath it)", async () => {
    useRouter().canGoBack.mockReturnValue(false);
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

    fireEvent.changeText(screen.getByDisplayValue("Existing Trip"), "Existing Trip Updated");
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => expect(updateTrip).toHaveBeenCalledTimes(1));

    expect(useRouter().back).not.toHaveBeenCalled();
    expect(useRouter().replace).toHaveBeenCalledWith("/trips/trip-1");
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

      // Save Changes stays disabled until something changes.
      fireEvent.changeText(screen.getByDisplayValue("Plain Trip"), "Plain Trip Updated");
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
