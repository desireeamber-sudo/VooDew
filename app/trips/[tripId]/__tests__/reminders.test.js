import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import * as Notifications from "expo-notifications";
import RemindersScreen from "../reminders";
import {
  subscribeToTrip,
  subscribeToChecklist,
  subscribeToReminders,
  addReminder,
  updateReminder,
  deleteReminder
} from "../../../../services/tripService";
import { combineDateAndTimeStrings } from "../../../../utils/dateUtils";

jest.mock("../../../../services/tripService");

const TITLE_PLACEHOLDER = "e.g. Check in for flight";

const FUTURE_REMINDER = {
  id: "rem-1",
  title: "Buy concert tickets",
  description: "",
  dateTime: new Date(2026, 7, 25, 9, 0, 0).toISOString(),
  enabled: true,
  linkedChecklistItemId: null,
  osIdentifier: "existing-os-id"
};

describe("Reminders screen", () => {
  beforeEach(() => {
    useLocalSearchParams.mockReturnValue({ tripId: "trip-1" });
    subscribeToTrip.mockReset().mockImplementation((tripId, onChange) => {
      onChange({ id: "trip-1", startDate: "2026-08-14" });
      return () => {};
    });
    subscribeToChecklist.mockReset().mockImplementation((tripId, onChange) => {
      onChange([]);
      return () => {};
    });
    subscribeToReminders.mockReset().mockImplementation((tripId, onChange) => {
      onChange([]);
      return () => {};
    });
    addReminder.mockReset().mockResolvedValue(undefined);
    updateReminder.mockReset().mockResolvedValue(undefined);
    deleteReminder.mockReset().mockResolvedValue(undefined);
    Notifications.scheduleNotificationAsync.mockClear().mockResolvedValue("mock-notification-id");
    Notifications.cancelScheduledNotificationAsync.mockClear();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
    jest.useRealTimers();
  });

  test("creates a reminder with a future date/time, scheduling a real (mocked) local notification", async () => {
    // Uses the real clock -- the trip's startDate (Aug 14, 2026) just needs
    // to be in the future, which it reliably is for as long as this test
    // suite is run before that date.
    render(<RemindersScreen />);

    fireEvent.press(screen.getByText("+ New Reminder"));
    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Buy concert tickets");

    // Date defaults to the trip's start date (Aug 14, 2026) -- open the
    // branded calendar, confirm that same day, and close it.
    fireEvent.press(screen.getByTestId("reminder-date"));
    fireEvent.press(screen.getByTestId("reminder-date-day-2026-08-14"));
    fireEvent.press(screen.getByTestId("reminder-date-confirm"));

    // Time starts unset -- the picker's default pending selection is 9:00
    // AM, so just confirming it is equivalent to picking 9:00 AM.
    fireEvent.press(screen.getByTestId("reminder-time"));
    fireEvent.press(screen.getByTestId("reminder-time-confirm"));

    fireEvent.press(screen.getByText("Create Reminder"));

    const expectedWhen = combineDateAndTimeStrings("2026-08-14", "09:00");
    await waitFor(() => expect(addReminder).toHaveBeenCalledTimes(1));
    expect(addReminder).toHaveBeenCalledWith(
      "trip-1",
      expect.objectContaining({
        title: "Buy concert tickets",
        dateTime: expectedWhen.toISOString(),
        enabled: true,
        linkedChecklistItemId: null,
        osIdentifier: "mock-notification-id"
      })
    );
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.objectContaining({ title: "Buy concert tickets" }) })
    );
  });

  test("selecting a custom hour/minute/period on the time picker produces the right 24-hour time", async () => {
    render(<RemindersScreen />);
    fireEvent.press(screen.getByText("+ New Reminder"));
    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Evening reminder");

    fireEvent.press(screen.getByTestId("reminder-date"));
    fireEvent.press(screen.getByTestId("reminder-date-day-2026-08-14"));
    fireEvent.press(screen.getByTestId("reminder-date-confirm"));

    fireEvent.press(screen.getByTestId("reminder-time"));
    fireEvent.press(screen.getByTestId("reminder-time-hour-7"));
    fireEvent.press(screen.getByTestId("reminder-time-minute-30"));
    fireEvent.press(screen.getByTestId("reminder-time-period-PM"));
    expect(screen.getByText("7:30 PM")).toBeTruthy(); // live preview inside the picker
    fireEvent.press(screen.getByTestId("reminder-time-confirm"));

    fireEvent.press(screen.getByText("Create Reminder"));

    const expectedWhen = combineDateAndTimeStrings("2026-08-14", "19:30");
    await waitFor(() => expect(addReminder).toHaveBeenCalledTimes(1));
    expect(addReminder.mock.calls[0][1].dateTime).toBe(expectedWhen.toISOString());
  });

  test("rejects saving a reminder whose date/time has already passed", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 20, 12, 0, 0)); // "now" = Aug 20, 2026
    render(<RemindersScreen />);

    fireEvent.press(screen.getByText("+ New Reminder"));
    fireEvent.changeText(screen.getByPlaceholderText(TITLE_PLACEHOLDER), "Too late reminder");

    // Trip start date (Aug 14, 2026) is now in the past relative to "now".
    fireEvent.press(screen.getByTestId("reminder-date"));
    fireEvent.press(screen.getByTestId("reminder-date-day-2026-08-14"));
    fireEvent.press(screen.getByTestId("reminder-date-confirm"));
    fireEvent.press(screen.getByTestId("reminder-time"));
    fireEvent.press(screen.getByTestId("reminder-time-confirm"));

    fireEvent.press(screen.getByText("Create Reminder"));

    expect(screen.getByText("Choose a date and time in the future.")).toBeTruthy();
    expect(addReminder).not.toHaveBeenCalled();
  });

  test("toggling an enabled reminder off cancels the scheduled notification", async () => {
    subscribeToReminders.mockImplementation((tripId, onChange) => {
      onChange([FUTURE_REMINDER]);
      return () => {};
    });
    render(<RemindersScreen />);

    fireEvent.press(screen.getByText("Enabled"));

    await waitFor(() => expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("existing-os-id"));
    expect(updateReminder).toHaveBeenCalledWith("trip-1", "rem-1", { enabled: false, osIdentifier: null });
  });

  test("deleting a reminder asks for confirmation before cancelling and removing it", async () => {
    subscribeToReminders.mockImplementation((tripId, onChange) => {
      onChange([FUTURE_REMINDER]);
      return () => {};
    });
    render(<RemindersScreen />);

    fireEvent.press(screen.getByTestId("reminder-delete-rem-1"));

    expect(Alert.alert).toHaveBeenCalledWith("Delete this reminder?", "Buy concert tickets", expect.any(Array));
    expect(deleteReminder).not.toHaveBeenCalled();

    const buttons = Alert.alert.mock.calls[0][2];
    const deleteButton = buttons.find((b) => b.text === "Delete");
    await deleteButton.onPress();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith("existing-os-id");
    expect(deleteReminder).toHaveBeenCalledWith("trip-1", "rem-1");
  });
});
